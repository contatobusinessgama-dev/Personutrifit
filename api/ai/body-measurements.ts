import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-4-hydrogen",
] as const;

const REQUEST_TIMEOUT_MS = 28000;

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const preParsed = (req as IncomingMessage & { body?: unknown }).body;
  if (preParsed && typeof preParsed === "object") {
    return preParsed as Record<string, unknown>;
  }
  if (typeof preParsed === "string") {
    return JSON.parse(preParsed) as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function parseDataUrl(
  dataUrl?: string
): { mimeType: string; data: string } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl
    .trim()
    .match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const data = match[2].replace(/\s+/g, "");
  if (!data || data.length < 100) return null;
  return { mimeType, data };
}

function clampMetric(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Number(Math.min(max, Math.max(min, n)).toFixed(1));
}

function normalizeConfidence(val: unknown): "alta" | "media" | "baixa" {
  const s = String(val || "").toLowerCase().trim();
  if (s === "alta" || s === "high") return "alta";
  if (s === "baixa" || s === "low") return "baixa";
  return "media";
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`MODEL_TIMEOUT: ${label}`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body: {
    photos?: { front?: string; side?: string; back?: string };
    profile?: {
      name?: string;
      sex?: string;
      age?: number;
      heightCm?: number;
      weightKg?: number;
    };
    photoDate?: string;
    previousMeasurements?: Record<string, unknown> | null;
  };

  try {
    body = (await readJsonBody(req)) as typeof body;
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Corpo da requisição inválido." }));
    return;
  }

  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    ""
  ).trim();
  if (!apiKey) {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        error: "A IA ainda não está ativada neste ambiente. Configure GEMINI_API_KEY.",
        code: "MISSING_API_KEY",
      })
    );
    return;
  }

  const angleList: { key: "front" | "side" | "back"; label: string; raw?: string }[] = [
    { key: "front", label: "Foto 1: FRENTE (vista frontal)", raw: body.photos?.front },
    { key: "side", label: "Foto 2: LADO (vista lateral/perfil)", raw: body.photos?.side },
    { key: "back", label: "Foto 3: COSTAS (vista posterior)", raw: body.photos?.back },
  ];

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];
  const anglesAnalyzed: ("front" | "side" | "back")[] = [];

  for (const item of angleList) {
    const parsed = parseDataUrl(item.raw);
    if (parsed) {
      anglesAnalyzed.push(item.key);
      parts.push({ text: item.label });
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
  }

  if (anglesAnalyzed.length === 0) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: "Envie pelo menos uma foto corporal (Frente, Lado ou Costas) para medir com IA.",
      })
    );
    return;
  }

  const sexLabel = body.profile?.sex === "F" ? "Feminino" : "Masculino";
  const heightCm = Number(body.profile?.heightCm) || 172;
  const weightKg = Number(body.profile?.weightKg) || 75;
  const age = Number(body.profile?.age) || 29;
  const firstName = (body.profile?.name || "Atleta").trim().split(/\s+/)[0] || "Atleta";

  parts.push({
    text: [
      `Você é um avaliador físico especialista em antropometria visual da plataforma Personal Nutri Fit.`,
      `Analise as ${anglesAnalyzed.length} foto(s) corporais (${anglesAnalyzed.join(", ")}) usando altura (${heightCm} cm), peso (${weightKg} kg), sexo (${sexLabel}) e idade (${age} anos) de ${firstName} na data ${body.photoDate || "hoje"} para estimar todas as 10 circunferências corporais em cm (pescoço, peito/tórax, cintura, barriga/abdômen, quadril, braços D/E, coxas/pernas D/E e panturrilha) + % de gordura visual estimada.`,
      body.previousMeasurements
        ? `Medição anterior para referência: ${JSON.stringify(body.previousMeasurements)}`
        : "Sem medição anterior registrada.",
      "Responda estritamente no JSON estruturado solicitado, em português do Brasil, de forma técnica e motivadora.",
    ].join("\n"),
  });

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  const schema = {
    type: Type.OBJECT,
    properties: {
      neckCm: { type: Type.NUMBER },
      chestCm: { type: Type.NUMBER },
      waistCm: { type: Type.NUMBER },
      abdomenCm: { type: Type.NUMBER },
      hipCm: { type: Type.NUMBER },
      armRightCm: { type: Type.NUMBER },
      armLeftCm: { type: Type.NUMBER },
      thighRightCm: { type: Type.NUMBER },
      thighLeftCm: { type: Type.NUMBER },
      calfCm: { type: Type.NUMBER },
      estimatedBodyFatPct: { type: Type.NUMBER },
      confidence: { type: Type.STRING },
      visualSummary: { type: Type.STRING },
      evolutionNote: { type: Type.STRING },
      photoTip: { type: Type.STRING },
    },
    required: [
      "neckCm",
      "chestCm",
      "waistCm",
      "abdomenCm",
      "hipCm",
      "armRightCm",
      "armLeftCm",
      "thighRightCm",
      "thighLeftCm",
      "calfCm",
      "estimatedBodyFatPct",
      "confidence",
      "visualSummary",
      "evolutionNote",
      "photoTip",
    ],
  };

  let lastErr: unknown = null;
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const candidate = GEMINI_MODELS[i];
    try {
      const isGemini3Or4 =
        candidate.startsWith("gemini-4-") || candidate.startsWith("gemini-3");
      const response = await withTimeout(
        ai.models.generateContent({
          model: candidate,
          contents: { parts },
          config: isGemini3Or4
            ? {
                responseMimeType: "application/json",
                responseSchema: schema,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              }
            : {
                responseMimeType: "application/json",
                responseSchema: schema,
              },
        }),
        REQUEST_TIMEOUT_MS,
        candidate
      );

      const rawText = (response.text || "").trim();
      if (!rawText) throw new Error("EMPTY_MODEL_RESPONSE");

      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      const parsedJson = JSON.parse(cleaned) as Record<string, unknown>;

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          neckCm: clampMetric(parsedJson.neckCm, 25, 65, 37),
          chestCm: clampMetric(parsedJson.chestCm, 60, 180, 98),
          waistCm: clampMetric(parsedJson.waistCm, 45, 180, 82),
          abdomenCm: clampMetric(parsedJson.abdomenCm, 45, 190, 86),
          hipCm: clampMetric(parsedJson.hipCm, 65, 180, 98),
          armRightCm: clampMetric(parsedJson.armRightCm, 18, 70, 34),
          armLeftCm: clampMetric(parsedJson.armLeftCm, 18, 70, 33.8),
          thighRightCm: clampMetric(parsedJson.thighRightCm, 32, 110, 56),
          thighLeftCm: clampMetric(parsedJson.thighLeftCm, 32, 110, 55.8),
          calfCm: clampMetric(parsedJson.calfCm, 22, 65, 37),
          estimatedBodyFatPct: clampMetric(parsedJson.estimatedBodyFatPct, 5, 55, 18),
          confidence: normalizeConfidence(parsedJson.confidence),
          visualSummary:
            typeof parsedJson.visualSummary === "string" && parsedJson.visualSummary.trim()
              ? parsedJson.visualSummary.trim()
              : "Análise visual concluída com base nas fotos e dados corporais.",
          evolutionNote:
            typeof parsedJson.evolutionNote === "string" && parsedJson.evolutionNote.trim()
              ? parsedJson.evolutionNote.trim()
              : "Salve estas medidas com a data de hoje para acompanhar sua evolução.",
          photoTip:
            typeof parsedJson.photoTip === "string" && parsedJson.photoTip.trim()
              ? parsedJson.photoTip.trim()
              : "Mantenha a mesma iluminação e distância do espelho nas próximas semanas.",
          anglesAnalyzed,
          model: candidate,
        })
      );
      return;
    } catch (err) {
      lastErr = err;
      if (i < GEMINI_MODELS.length - 1) {
        console.warn("[Bianco Fit Body Measurements Fallback Retry]", {
          model: candidate,
          nextModel: GEMINI_MODELS[i + 1],
          rawMessage: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }
  }

  console.error("[Bianco Fit Body Measurements API Error]", lastErr);
  res.statusCode = 500;
  res.end(
    JSON.stringify({
      error:
        "Não foi possível estimar as medidas pelas fotos agora. Tente novamente em instantes.",
    })
  );
}
