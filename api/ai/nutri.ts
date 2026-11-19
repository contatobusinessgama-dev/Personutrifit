import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODELS = [
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
] as const;

const FIRST_CHUNK_TIMEOUT_MS = 18000;

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface LatestMeasurementsContext {
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

interface NutriContext {
  studentName?: string;
  primaryGoal: string;
  secondaryFocuses: string[];
  customNote: string;
  muscleToday: string;
  level?: string;
  weeklyFrequency?: number;
  weightKg: number;
  targetWeightKg: number;
  heightCm: number;
  bmi?: number;
  bmiLabel?: string;
  age: number;
  sex: string;
  activityLabel: string;
  deficitLabel: string;
  tmb: number;
  get: number;
  calorieTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterTargetMl: number;
  latestMeasurements?: LatestMeasurementsContext | null;
}

const DEFAULT_NUTRI_CONTEXT: NutriContext = {
  primaryGoal: "Perder peso e definir o corpo",
  secondaryFocuses: [],
  customNote: "",
  muscleToday: "Costas + Bíceps",
  weightKg: 78,
  targetWeightKg: 70,
  heightCm: 174,
  age: 30,
  sex: "M",
  activityLabel: "Moderado (3-5x/sem)",
  deficitLabel: "Acelerado (-500 kcal)",
  tmb: 1738,
  get: 2694,
  calorieTarget: 2194,
  proteinG: 156,
  carbsG: 245,
  fatG: 65,
  waterTargetMl: 3120,
};

function getFirstName(name?: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Atleta";
  return trimmed.split(/\s+/)[0];
}

function formatMeasurementsLine(m?: LatestMeasurementsContext | null): string {
  if (!m) return "Nenhuma medição corporal registrada ainda.";
  const parts: string[] = [];
  if (m.neckCm) parts.push(`Pescoço ${m.neckCm}cm`);
  if (m.chestCm) parts.push(`Peito/Tórax ${m.chestCm}cm`);
  if (m.waistCm) parts.push(`Cintura ${m.waistCm}cm`);
  if (m.abdomenCm) parts.push(`Abdômen ${m.abdomenCm}cm`);
  if (m.hipCm) parts.push(`Quadril ${m.hipCm}cm`);
  if (m.armRightCm || m.armLeftCm) {
    parts.push(`Braços D/E ${m.armRightCm ?? "-"}cm / ${m.armLeftCm ?? "-"}cm`);
  }
  if (m.thighRightCm || m.thighLeftCm) {
    parts.push(`Coxas D/E ${m.thighRightCm ?? "-"}cm / ${m.thighLeftCm ?? "-"}cm`);
  }
  if (m.calfCm) parts.push(`Panturrilha ${m.calfCm}cm`);
  if (parts.length === 0) return "Apenas peso corporal registrado.";
  return `${parts.join(" | ")}${m.date ? ` (avaliado em ${m.date})` : ""}`;
}

function buildNutriSystemPrompt(ctx: NutriContext): string {
  const firstName = getFirstName(ctx.studentName);
  const focuses =
    ctx.secondaryFocuses && ctx.secondaryFocuses.length > 0
      ? ctx.secondaryFocuses.join(", ")
      : "Nenhum foco secundário definido";

  return [
    "Você é a Nutricionista Esportiva IA da plataforma Personal Nutri Fit, especialista em emagrecimento acelerado natural, definição corporal e nutrição aplicada à musculação.",
    "",
    "REGRAS ABSOLUTAS DE SEGURANÇA, PERSONALIZAÇÃO E CONTEÚDO:",
    `- SEMPRE chame o aluno pelo primeiro nome (${firstName}) e ajuste todas as quantidades, porções e estratégias exatamente para as calorias, macros e medidas corporais deste aluno.`,
    "- Foco 100% em déficit calórico natural, reeducação alimentar, alta ingestão proteica, saciedade e performance na academia.",
    "- NUNCA mencione, sugira ou cite medicamentos emagrecedores, remédios inibidores de apetite, canetas emagrecedoras ou substâncias farmacológicas.",
    "- Monte cardápios e estratégias usando ALIMENTOS REAIS BRASILEIROS acessíveis: ovos, peito de frango, patinho moído, tilápia/peixe, arroz, feijão, batata inglesa/doce, mandioca, tapioca, aveia, cuscuz, iogurte natural/desnatado, queijo minas/cottage, whey (opcional), frutas (banana, maçã, mamão, morango, melancia), legumes e folhas.",
    "- Informe sempre quantidades práticas (em gramas e medidas caseiras) coerentes com a meta calórica e de macronutrientes do aluno.",
    "- Responda em português do Brasil, de forma prática, acolhedora, direta e bem organizada em Markdown.",
    "",
    "DADOS METABÓLICOS E PERFIL COMPLETO DO ALUNO (CALCULADOS AUTOMATICAMENTE):",
    `- Nome completo: ${ctx.studentName || "Atleta Personal Nutri Fit"} (Primeiro nome: ${firstName})`,
    `- Dados corporais: ${ctx.weightKg} kg (Meta: ${ctx.targetWeightKg} kg), ${ctx.heightCm} cm${ctx.bmi ? `, IMC ${ctx.bmi} (${ctx.bmiLabel || ""})` : ""}, ${ctx.age} anos, sexo ${ctx.sex === "F" ? "Feminino" : "Masculino"}`,
    `- Medidas corporais recentes: ${formatMeasurementsLine(ctx.latestMeasurements)}`,
    `- Nível na academia: ${ctx.level || "Intermediário"} | Frequência: ${ctx.weeklyFrequency ?? 4}x/semana | Treino do dia: ${ctx.muscleToday}`,
    `- Objetivo principal: ${ctx.primaryGoal}`,
    `- Focos específicos: ${focuses}`,
    `- Observações pessoais: ${ctx.customNote ? ctx.customNote : "Sem observações extras"}`,
    `- Nível de atividade: ${ctx.activityLabel} | Estratégia de déficit: ${ctx.deficitLabel}`,
    `- TMB (Mifflin-St Jeor): ${ctx.tmb} kcal | GET: ${ctx.get} kcal`,
    `- Meta Calórica Diária: ${ctx.calorieTarget} kcal`,
    `- Metas de Macros: Proteína ${ctx.proteinG}g (2.0g/kg) | Carboidratos ${ctx.carbsG}g | Gorduras ${ctx.fatG}g`,
    `- Meta de Água Diária: ${(ctx.waterTargetMl / 1000).toFixed(2)} L (${ctx.waterTargetMl} ml)`,
  ].join("\n");
}

function mapContents(history: ChatHistoryItem[], message: string) {
  const trimmedHistory = Array.isArray(history) ? history.slice(-12) : [];
  const rawTurns: { role: "user" | "model"; text: string }[] = [];

  for (const item of trimmedHistory) {
    const text = typeof item?.content === "string" ? item.content.trim() : "";
    if (!text) continue;
    const role: "user" | "model" = item.role === "assistant" ? "model" : "user";
    if (rawTurns.length === 0 && role === "model") continue;
    rawTurns.push({ role, text });
  }

  rawTurns.push({ role: "user", text: message.trim() });

  const merged: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const turn of rawTurns) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === turn.role) {
      prev.parts.push({ text: turn.text });
    } else {
      merged.push({ role: turn.role, parts: [{ text: turn.text }] });
    }
  }
  return merged;
}

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

function formatError(
  err: unknown,
  meta?: { model?: string; durationMs?: number; stage?: string }
): {
  status: number;
  code: string;
  category: "auth" | "no_response" | "quota" | "unknown";
  message: string;
} {
  const raw = err instanceof Error ? err.message : String(err || "");
  const lower = raw.toLowerCase();

  let result: {
    status: number;
    code: string;
    category: "auth" | "no_response" | "quota" | "unknown";
    message: string;
  };

  if (raw.includes("MISSING_API_KEY")) {
    result = {
      status: 503,
      code: "MISSING_API_KEY",
      category: "auth",
      message:
        "A IA ainda não está ativada neste ambiente. Configure a variável GEMINI_API_KEY na Vercel (Settings → Environment Variables) e faça redeploy.",
    };
  } else if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("permission_denied") ||
    lower.includes("unauthenticated") ||
    lower.includes("unauthorized")
  ) {
    result = {
      status: 403,
      code: "INVALID_API_KEY",
      category: "auth",
      message:
        "Chave da API Gemini inválida ou sem permissão. Verifique GEMINI_API_KEY nas variáveis de ambiente.",
    };
  } else if (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    result = {
      status: 429,
      code: "QUOTA_EXHAUSTED",
      category: "quota",
      message:
        "O limite de uso da IA foi atingido temporariamente. Aguarde alguns segundos e tente novamente.",
    };
  } else if (raw.includes("MODEL_TIMEOUT") || lower.includes("timeout")) {
    result = {
      status: 504,
      code: "MODEL_TIMEOUT",
      category: "no_response",
      message:
        "O modelo da Nutricionista IA demorou muito para responder. Tente reconectar em instantes.",
    };
  } else if (raw.includes("EMPTY_MODEL_RESPONSE")) {
    result = {
      status: 502,
      code: "EMPTY_MODEL_RESPONSE",
      category: "no_response",
      message:
        "A Nutricionista IA não retornou resposta desta vez. Tente reconectar em instantes.",
    };
  } else if (
    lower.includes("404") ||
    lower.includes("not_found") ||
    lower.includes("model not found") ||
    lower.includes("no longer available")
  ) {
    result = {
      status: 404,
      code: "MODEL_NOT_FOUND",
      category: "no_response",
      message:
        "Os modelos da Nutricionista IA estão temporariamente indisponíveis. Tente reconectar em instantes.",
    };
  } else {
    result = {
      status: 500,
      code: "INTERNAL_ERROR",
      category: "no_response",
      message:
        "Não foi possível obter resposta da Nutricionista IA agora. Tente reconectar em instantes.",
    };
  }

  console.error("[Bianco Fit Nutri IA API Error]", {
    timestamp: new Date().toISOString(),
    endpoint: "/api/ai/nutri",
    stage: meta?.stage || "handler_error",
    model: meta?.model,
    status: result.status,
    code: result.code,
    category: result.category,
    durationMs: meta?.durationMs,
    rawMessage: raw,
    stack: err instanceof Error ? err.stack : undefined,
  });

  return result;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestStartedAt = Date.now();

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body: {
    message?: string;
    history?: ChatHistoryItem[];
    context?: NutriContext;
    model?: string;
  };
  try {
    body = (await readJsonBody(req)) as typeof body;
  } catch (err) {
    console.error("[Bianco Fit Nutri IA API Error]", {
      timestamp: new Date().toISOString(),
      endpoint: "/api/ai/nutri",
      stage: "parse_body",
      status: 400,
      rawMessage: err instanceof Error ? err.message : String(err),
    });
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Corpo da requisição inválido." }));
    return;
  }

  const { message, history, context, model } = body;
  if (!message || !message.trim()) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Envie uma mensagem para a Nutricionista IA." }));
    return;
  }

  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    ""
  ).trim();
  if (!apiKey) {
    const parsed = formatError(new Error("MISSING_API_KEY"), {
      model,
      stage: "auth_check",
      durationMs: Date.now() - requestStartedAt,
    });
    res.statusCode = parsed.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: parsed.message,
        code: parsed.code,
        status: parsed.status,
        category: parsed.category,
      })
    );
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  const idx = model ? GEMINI_MODELS.indexOf(model as (typeof GEMINI_MODELS)[number]) : -1;
  const modelsToTry =
    idx > 0
      ? [...GEMINI_MODELS.slice(idx), ...GEMINI_MODELS.slice(0, idx)]
      : [...GEMINI_MODELS];

  const systemInstruction = buildNutriSystemPrompt(context || DEFAULT_NUTRI_CONTEXT);
  const contents = mapContents(history || [], message.trim());

  let lastErr: unknown = null;
  let lastModel: string | undefined = model;
  for (let i = 0; i < modelsToTry.length; i++) {
    const candidate = modelsToTry[i];
    lastModel = candidate;
    const modelStartedAt = Date.now();
    let emitted = false;
    try {
      const stream = await withTimeout(
        ai.models.generateContentStream({
          model: candidate,
          contents,
          config: { systemInstruction },
        }),
        FIRST_CHUNK_TIMEOUT_MS,
        candidate
      );

      const iterator = stream[Symbol.asyncIterator]();
      while (true) {
        const next = emitted
          ? await iterator.next()
          : await withTimeout(iterator.next(), FIRST_CHUNK_TIMEOUT_MS, `${candidate}:first`);
        if (next.done) break;
        const text = next.value?.text;
        if (text) {
          emitted = true;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      if (!emitted) {
        throw new Error(`EMPTY_MODEL_RESPONSE: ${candidate}`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    } catch (err) {
      lastErr = err;
      const errLower = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isAuthErr =
        errLower.includes("401") ||
        errLower.includes("403") ||
        errLower.includes("api_key_invalid") ||
        errLower.includes("api key not valid") ||
        errLower.includes("permission_denied") ||
        errLower.includes("unauthenticated") ||
        errLower.includes("unauthorized");
      const willRetry = !emitted && !isAuthErr && i < modelsToTry.length - 1;
      console.error("[Bianco Fit Nutri IA Model Attempt Error]", {
        timestamp: new Date().toISOString(),
        endpoint: "/api/ai/nutri",
        model: candidate,
        nextModel: willRetry ? modelsToTry[i + 1] : undefined,
        emittedAnyChunk: emitted,
        durationMs: Date.now() - modelStartedAt,
        rawMessage: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      if (willRetry) {
        continue;
      }
      break;
    }
  }

  const parsed = formatError(lastErr, {
    model: lastModel,
    stage: "stream_exhausted",
    durationMs: Date.now() - requestStartedAt,
  });
  res.write(
    `data: ${JSON.stringify({
      error: parsed.message,
      code: parsed.code,
      status: parsed.status,
      category: parsed.category,
    })}\n\n`
  );
  res.end();
}
