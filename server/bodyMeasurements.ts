import { Type } from "@google/genai";
import { generateWithFallback } from "./gemini.ts";

export interface BodyMeasurementPhotoInput {
  front?: string;
  side?: string;
  back?: string;
}

export interface BodyMeasurementProfileInput {
  name?: string;
  sex?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
}

export interface PreviousBodyMeasurementInput {
  date?: string;
  weightKg?: number;
  neckCm?: number;
  chestCm?: number;
  waistCm?: number;
  abdomenCm?: number;
  hipCm?: number;
  armRightCm?: number;
  armLeftCm?: number;
  thighRightCm?: number;
  thighLeftCm?: number;
  calfCm?: number;
}

export interface BodyMeasurementsAiResponse {
  neckCm: number;
  chestCm: number;
  waistCm: number;
  abdomenCm: number;
  hipCm: number;
  armRightCm: number;
  armLeftCm: number;
  thighRightCm: number;
  thighLeftCm: number;
  calfCm: number;
  estimatedBodyFatPct: number;
  confidence: "alta" | "media" | "baixa";
  visualSummary: string;
  evolutionNote: string;
  photoTip: string;
  anglesAnalyzed: ("front" | "side" | "back")[];
  model?: string;
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
  const clamped = Math.min(max, Math.max(min, n));
  return Number(clamped.toFixed(1));
}

function normalizeConfidence(val: unknown): "alta" | "media" | "baixa" {
  const s = String(val || "").toLowerCase().trim();
  if (s === "alta" || s === "high") return "alta";
  if (s === "baixa" || s === "low") return "baixa";
  return "media";
}

export async function analyzeBodyMeasurementsFromPhotos(params: {
  photos: BodyMeasurementPhotoInput;
  profile?: BodyMeasurementProfileInput;
  photoDate?: string;
  previousMeasurements?: PreviousBodyMeasurementInput | null;
}): Promise<BodyMeasurementsAiResponse> {
  const angleList: { key: "front" | "side" | "back"; label: string; raw?: string }[] = [
    { key: "front", label: "Foto 1: FRENTE (vista frontal)", raw: params.photos?.front },
    { key: "side", label: "Foto 2: LADO (vista lateral/perfil)", raw: params.photos?.side },
    { key: "back", label: "Foto 3: COSTAS (vista posterior)", raw: params.photos?.back },
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
      parts.push({
        inlineData: {
          mimeType: parsed.mimeType,
          data: parsed.data,
        },
      });
    }
  }

  if (anglesAnalyzed.length === 0) {
    throw new Error("NO_VALID_PHOTOS");
  }

  const sexLabel = params.profile?.sex === "F" ? "Feminino" : "Masculino";
  const heightCm = Number(params.profile?.heightCm) || 172;
  const weightKg = Number(params.profile?.weightKg) || 75;
  const age = Number(params.profile?.age) || 29;
  const firstName = (params.profile?.name || "Atleta").trim().split(/\s+/)[0] || "Atleta";

  const prev = params.previousMeasurements;
  const prevSummary = prev
    ? [
        prev.date ? `Data anterior: ${prev.date}` : "",
        prev.weightKg ? `Peso: ${prev.weightKg}kg` : "",
        prev.chestCm ? `Peito: ${prev.chestCm}cm` : "",
        prev.waistCm ? `Cintura: ${prev.waistCm}cm` : "",
        prev.abdomenCm ? `Barriga/Abdômen: ${prev.abdomenCm}cm` : "",
        prev.hipCm ? `Quadril: ${prev.hipCm}cm` : "",
        prev.armRightCm ? `Braço D: ${prev.armRightCm}cm` : "",
        prev.thighRightCm ? `Coxa D: ${prev.thighRightCm}cm` : "",
        prev.calfCm ? `Panturrilha: ${prev.calfCm}cm` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    : "Nenhuma medição anterior registrada.";

  const promptText = [
    `Você é um avaliador físico especialista em antropometria visual da plataforma Personal Nutri Fit.`,
    `Analise as ${anglesAnalyzed.length} foto(s) corporais enviadas (${anglesAnalyzed.join(", ")}) junto com a altura e peso de referência do aluno para estimar todas as circunferências corporais em centímetros (cm) com coerência anatômica.`,
    "",
    "DADOS DE CALIBRAÇÃO ANTROPOMÉTRICA DO ALUNO:",
    `- Aluno: ${firstName} | Sexo: ${sexLabel} | Idade: ${age} anos`,
    `- Altura de referência (escala): ${heightCm} cm`,
    `- Peso corporal atual na data da foto: ${weightKg} kg`,
    `- Data do registro fotográfico: ${params.photoDate || "Hoje"}`,
    `- Medição anterior para referência de evolução: ${prevSummary}`,
    "",
    "INSTRUÇÕES DE CÁLCULO E COERÊNCIA:",
    "1. Use a altura (cm) e peso (kg) como escala biométrica principal, ajustando pelas proporções reais visíveis nas fotos de frente, lado (especialmente projeção da barriga/abdômen, glúteo e tórax) e costas (largura dorsal, cintura e simetria de braços/pernas).",
    "2. Estime TODAS as 10 circunferências em cm (1 casa decimal): pescoço, peito/tórax, cintura (parte mais estreita), abdômen/barriga (linha do umbigo), quadril (parte mais larga dos glúteos), braço direito, braço esquerdo, coxa/perna direita, coxa/perna esquerda e panturrilha.",
    "3. Estime o percentual de gordura visual aproximado (estimatedBodyFatPct).",
    "4. Se todas as 3 fotos (frente, lado e costas) estiverem visíveis e bem enquadradas, use confidence 'alta' ou 'media'; se faltar ângulo ou o corpo estiver parcialmente visível, use 'media' ou 'baixa' e oriente no campo photoTip.",
    "5. Escreva visualSummary, evolutionNote e photoTip em português do Brasil, de forma respeitosa, técnica, encorajadora e objetiva (sem citar medicamentos).",
  ].join("\n");

  parts.push({ text: promptText });

  const { response, model } = await generateWithFallback({
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          neckCm: { type: Type.NUMBER, description: "Circunferência do pescoço em cm" },
          chestCm: { type: Type.NUMBER, description: "Circunferência do peito/tórax em cm" },
          waistCm: { type: Type.NUMBER, description: "Circunferência da cintura em cm" },
          abdomenCm: {
            type: Type.NUMBER,
            description: "Circunferência da barriga/abdômen na altura do umbigo em cm",
          },
          hipCm: { type: Type.NUMBER, description: "Circunferência do quadril/glúteo em cm" },
          armRightCm: { type: Type.NUMBER, description: "Circunferência do braço direito em cm" },
          armLeftCm: { type: Type.NUMBER, description: "Circunferência do braço esquerdo em cm" },
          thighRightCm: {
            type: Type.NUMBER,
            description: "Circunferência da coxa/perna direita em cm",
          },
          thighLeftCm: {
            type: Type.NUMBER,
            description: "Circunferência da coxa/perna esquerda em cm",
          },
          calfCm: { type: Type.NUMBER, description: "Circunferência da panturrilha em cm" },
          estimatedBodyFatPct: {
            type: Type.NUMBER,
            description: "Estimativa visual de percentual de gordura corporal (%)",
          },
          confidence: {
            type: Type.STRING,
            description: "Nível de confiança visual: alta, media ou baixa",
          },
          visualSummary: {
            type: Type.STRING,
            description:
              "Análise visual clara de 2 a 3 frases sobre proporções, definição e postura observadas",
          },
          evolutionNote: {
            type: Type.STRING,
            description:
              "Nota de comparação com o registro anterior ou diagnóstico inicial para acompanhar nas próximas semanas",
          },
          photoTip: {
            type: Type.STRING,
            description:
              "Dica curta para manter padrão de distância/iluminação ou adicionar ângulos faltantes",
          },
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
      },
    },
  });

  const rawText = (response.text || "").trim();
  if (!rawText) {
    throw new Error("EMPTY_MODEL_RESPONSE");
  }

  let parsedJson: Record<string, unknown>;
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    parsedJson = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error("INVALID_JSON_MODEL_RESPONSE");
  }

  return {
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
        : "Análise visual concluída com base nas fotos e nos seus dados de altura e peso.",
    evolutionNote:
      typeof parsedJson.evolutionNote === "string" && parsedJson.evolutionNote.trim()
        ? parsedJson.evolutionNote.trim()
        : "Salve estas medidas com a data de hoje para comparar a evolução semana a semana.",
    photoTip:
      typeof parsedJson.photoTip === "string" && parsedJson.photoTip.trim()
        ? parsedJson.photoTip.trim()
        : "Mantenha a mesma distância do espelho e iluminação frontal nas próximas semanas.",
    anglesAnalyzed,
    model,
  };
}
