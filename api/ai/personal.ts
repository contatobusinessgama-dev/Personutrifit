import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

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

interface PersonalContext {
  studentName?: string;
  sex?: string;
  age?: number;
  weightKg?: number;
  targetWeightKg?: number;
  heightCm?: number;
  bmi?: number;
  bmiLabel?: string;
  weeklyFrequency?: number;
  primaryGoal: string;
  secondaryFocuses: string[];
  customNote: string;
  muscleToday: string;
  level: string;
  availableTime: number;
  latestMeasurements?: LatestMeasurementsContext | null;
}

const DEFAULT_PERSONAL_CONTEXT: PersonalContext = {
  primaryGoal: "Perder peso e definir o corpo",
  secondaryFocuses: [],
  customNote: "",
  muscleToday: "Costas + Bíceps",
  level: "Intermediário",
  availableTime: 60,
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

function buildPersonalSystemPrompt(ctx: PersonalContext): string {
  const firstName = getFirstName(ctx.studentName);
  const focuses =
    ctx.secondaryFocuses && ctx.secondaryFocuses.length > 0
      ? ctx.secondaryFocuses.join(", ")
      : "Nenhum foco secundário definido";

  return [
    "Você é o Personal Trainer IA oficial da plataforma Personal Nutri Fit, especialista em musculação presencial em academias completas (estilo rede Panobianco Academia), emagrecimento acelerado natural e definição corporal.",
    "",
    "REGRAS ABSOLUTAS DE SEGURANÇA, PERSONALIZAÇÃO E CONTEÚDO:",
    `- SEMPRE chame o aluno pelo primeiro nome (${firstName}) de forma natural e acolhedora.`,
    "- Adapte volume, seleção de aparelhos, estimativa de esforço/carga inicial e intensidade EXATAMENTE ao perfil físico (sexo, idade, peso, altura, IMC, medidas e nível) deste aluno.",
    "- Foco 100% em treino presencial de academia, musculação em máquinas articuladas, polias/cross, pesos livres, cardio na academia e hábitos naturais.",
    "- NUNCA mencione, sugira ou cite medicamentos emagrecedores, canetas emagrecedoras, remédios para perda de peso ou substâncias farmacológicas.",
    "- Prescreva exclusivamente exercícios reais de academia (máquinas articuladas, polias, halteres, barras, esteira inclinada, simulador de escada, bike, elíptico, funcional de academia).",
    "- Sempre respeite restrições ou desconfortos descritos nas observações do aluno (ex.: desconforto no joelho, lombar ou ombro), adaptando a escolha dos aparelhos com segurança.",
    "- Responda em português do Brasil, de forma direta, técnica, motivadora e escaneável com títulos claros e listas.",
    "",
    "PERFIL COMPLETO DO ALUNO (INJETADO AUTOMATICAMENTE):",
    `- Nome completo: ${ctx.studentName || "Atleta Personal Nutri Fit"} (Primeiro nome: ${firstName})`,
    `- Sexo: ${ctx.sex === "F" ? "Feminino" : "Masculino"} | Idade: ${ctx.age ?? 29} anos`,
    `- Corpo: ${ctx.weightKg ?? 75} kg (Meta: ${ctx.targetWeightKg ?? 70} kg) | Altura: ${ctx.heightCm ?? 172} cm${ctx.bmi ? ` | IMC: ${ctx.bmi} (${ctx.bmiLabel || ""})` : ""}`,
    `- Medidas corporais recentes: ${formatMeasurementsLine(ctx.latestMeasurements)}`,
    `- Nível na academia: ${ctx.level} | Frequência semanal: ${ctx.weeklyFrequency ?? 4}x/semana`,
    `- Tempo disponível hoje: ${ctx.availableTime} minutos`,
    `- O que vai malhar hoje: ${ctx.muscleToday}`,
    `- Objetivo principal: ${ctx.primaryGoal}`,
    `- Focos específicos: ${focuses}`,
    `- Observações e restrições pessoais: ${ctx.customNote ? ctx.customNote : "Sem restrições informadas"}`,
    "",
    "ESTRUTURA ESPERADA QUANDO MONTAR UM TREINO:",
    "1. Saudação direta usando o primeiro nome do aluno + aquecimento específico breve (3-5 min).",
    "2. Ordem inteligente dos exercícios (multiarticulares primeiro, isoladores depois), contendo para cada exercício:",
    "   - Nome do exercício e tipo de aparelho (Máquina Articulada, Polia/Cross ou Peso Livre)",
    "   - Séries x Repetições + Tempo de descanso + Orientação de carga/RPE adequada ao nível do aluno",
    "   - Dica prática de ajuste da máquina/banco/polia e postura",
    "3. Cardio estratégico final (quando alinhado ao objetivo e ao tempo disponível).",
    "4. Se o aluno pedir substituição por aparelho ocupado, responda na hora com 2 opções equivalentes na academia que trabalhem o mesmo padrão motor.",
  ]
    .filter(Boolean)
    .join("\n");
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
        "O modelo do Personal IA demorou muito para responder. Tente reconectar em instantes.",
    };
  } else if (raw.includes("EMPTY_MODEL_RESPONSE")) {
    result = {
      status: 502,
      code: "EMPTY_MODEL_RESPONSE",
      category: "no_response",
      message:
        "O Personal IA não retornou resposta desta vez. Tente reconectar em instantes.",
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
        "Os modelos do Personal IA estão temporariamente indisponíveis. Tente reconectar em instantes.",
    };
  } else {
    result = {
      status: 500,
      code: "INTERNAL_ERROR",
      category: "no_response",
      message:
        "Não foi possível obter resposta do Personal IA agora. Tente reconectar em instantes.",
    };
  }

  console.error("[Bianco Fit Personal IA API Error]", {
    timestamp: new Date().toISOString(),
    endpoint: "/api/ai/personal",
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
    context?: PersonalContext;
    model?: string;
  };
  try {
    body = (await readJsonBody(req)) as typeof body;
  } catch (err) {
    console.error("[Bianco Fit Personal IA API Error]", {
      timestamp: new Date().toISOString(),
      endpoint: "/api/ai/personal",
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
    res.end(JSON.stringify({ error: "Envie uma mensagem para o Personal IA." }));
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

  const systemInstruction = buildPersonalSystemPrompt(context || DEFAULT_PERSONAL_CONTEXT);
  const contents = mapContents(history || [], message.trim());

  let lastErr: unknown = null;
  let lastModel: string | undefined = model;
  for (let i = 0; i < modelsToTry.length; i++) {
    const candidate = modelsToTry[i];
    lastModel = candidate;
    const modelStartedAt = Date.now();
    let emitted = false;
    try {
      const isGemini3Or4 =
        candidate.startsWith("gemini-4-") || candidate.startsWith("gemini-3");
      const stream = await withTimeout(
        ai.models.generateContentStream({
          model: candidate,
          contents,
          config: isGemini3Or4
            ? {
                systemInstruction,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              }
            : { systemInstruction },
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
      console.error("[Bianco Fit Personal IA Model Attempt Error]", {
        timestamp: new Date().toISOString(),
        endpoint: "/api/ai/personal",
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
