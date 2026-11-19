import {
  GenerateContentParameters,
  GenerateContentResponse,
  GoogleGenAI,
} from "@google/genai";

/**
 * Centralized Gemini model fallback chain.
 * Attempts fast, healthy active models first and rotates automatically on
 * model-not-found (404), transient server errors (500/503/504), or stall timeouts.
 */
export const GEMINI_MODELS = [
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
] as const;

export type GeminiModelName = (typeof GEMINI_MODELS)[number];

export type FallbackGenerateParams = Omit<GenerateContentParameters, "model"> & {
  preferredModel?: string;
};

const FIRST_CHUNK_TIMEOUT_MS = 18000;

function buildRotationList(preferredModel?: string): readonly GeminiModelName[] {
  if (!preferredModel) return GEMINI_MODELS;
  const idx = GEMINI_MODELS.indexOf(preferredModel as GeminiModelName);
  if (idx <= 0) return GEMINI_MODELS;
  return [
    ...GEMINI_MODELS.slice(idx),
    ...GEMINI_MODELS.slice(0, idx),
  ];
}

function resolveServerGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    ""
  ).trim();
}

export function hasGeminiApiKey(): boolean {
  return Boolean(resolveServerGeminiApiKey());
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = resolveServerGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getErrorText(err: unknown): string {
  if (err instanceof Error) {
    return err.message || String(err);
  }
  if (typeof err === "object" && err !== null) {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

export function isAuthKeyError(err: unknown): boolean {
  const raw = getErrorText(err).toLowerCase();
  return (
    raw.includes("missing_api_key") ||
    raw.includes("api_key_invalid") ||
    raw.includes("api key not valid") ||
    raw.includes("unauthenticated") ||
    raw.includes("permission_denied")
  );
}

export function isModelNotFoundError(err: unknown): boolean {
  const status =
    typeof err === "object" && err !== null
      ? (err as { status?: number | string; code?: number | string }).status ??
        (err as { code?: number | string }).code
      : undefined;

  if (status === 404 || status === "404" || status === "NOT_FOUND") {
    return true;
  }

  const raw = getErrorText(err).toLowerCase();
  return (
    raw.includes("404") ||
    raw.includes("not_found") ||
    raw.includes("model not found") ||
    raw.includes("is not found") ||
    raw.includes("no longer available") ||
    raw.includes("is not supported for generatecontent")
  );
}

function shouldFallbackToNextModel(err: unknown): boolean {
  if (isAuthKeyError(err)) return false;
  return true;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`MODEL_TIMEOUT: ${label} exceeded ${ms}ms`));
    }, ms);
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

function extractErrorMeta(err: unknown): {
  rawMessage: string;
  name?: string;
  httpStatus?: number | string;
  stack?: string;
} {
  if (err instanceof Error) {
    const rec = err as Error & { status?: number | string; code?: number | string };
    return {
      rawMessage: err.message || String(err),
      name: err.name,
      httpStatus: rec.status ?? rec.code,
      stack: err.stack,
    };
  }
  if (typeof err === "object" && err !== null) {
    const rec = err as { status?: number | string; code?: number | string; message?: string };
    return {
      rawMessage: rec.message || getErrorText(err),
      httpStatus: rec.status ?? rec.code,
    };
  }
  return { rawMessage: String(err) };
}

function logServerAiError(details: {
  stage: string;
  endpoint?: string;
  model?: string;
  nextModel?: string;
  status?: number;
  code?: string;
  category?: string;
  durationMs?: number;
  err: unknown;
}) {
  const meta = extractErrorMeta(details.err);
  console.error("[Bianco Fit AI Server Error]", {
    timestamp: new Date().toISOString(),
    stage: details.stage,
    endpoint: details.endpoint || "server/gemini",
    model: details.model,
    nextModel: details.nextModel,
    status: details.status ?? meta.httpStatus,
    code: details.code,
    category: details.category,
    durationMs: details.durationMs,
    errorName: meta.name,
    rawMessage: meta.rawMessage,
    stack: meta.stack,
  });
}

/**
 * Calls ai.models.generateContent with automatic fallback across GEMINI_MODELS
 * whenever a model fails with a retryable error.
 */
export async function generateWithFallback(
  params: FallbackGenerateParams
): Promise<{ response: GenerateContentResponse; model: GeminiModelName }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error("MISSING_API_KEY");
  }

  const { preferredModel, ...sdkParams } = params;
  const modelsToTry = buildRotationList(preferredModel);
  let lastError: unknown;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const startedAt = Date.now();
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          ...sdkParams,
          model,
        }),
        FIRST_CHUNK_TIMEOUT_MS,
        model
      );
      return { response, model };
    } catch (err) {
      lastError = err;
      const hasNext = i < modelsToTry.length - 1;
      logServerAiError({
        stage: hasNext && shouldFallbackToNextModel(err) ? "generate_fallback_retry" : "generate_failed",
        model,
        nextModel: hasNext ? modelsToTry[i + 1] : undefined,
        durationMs: Date.now() - startedAt,
        err,
      });
      if (shouldFallbackToNextModel(err) && hasNext) {
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("ALL_MODELS_UNAVAILABLE");
}

/**
 * Calls ai.models.generateContentStream with automatic fallback across GEMINI_MODELS
 * when an error or initial timeout happens before any chunk is emitted.
 */
export async function generateStreamWithFallback(
  params: FallbackGenerateParams,
  onChunk: (text: string) => void,
  endpoint?: string
): Promise<{ model: GeminiModelName }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error("MISSING_API_KEY");
  }

  const { preferredModel, ...sdkParams } = params;
  const modelsToTry = buildRotationList(preferredModel);
  let lastError: unknown;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const startedAt = Date.now();
    let emittedAnyChunk = false;

    try {
      const stream = await withTimeout(
        ai.models.generateContentStream({
          ...sdkParams,
          model,
        }),
        FIRST_CHUNK_TIMEOUT_MS,
        model
      );

      const iterator = stream[Symbol.asyncIterator]();
      while (true) {
        const nextResult = emittedAnyChunk
          ? await iterator.next()
          : await withTimeout(iterator.next(), FIRST_CHUNK_TIMEOUT_MS, `${model}:first-chunk`);
        if (nextResult.done) break;
        const text = nextResult.value?.text;
        if (text) {
          emittedAnyChunk = true;
          onChunk(text);
        }
      }

      if (!emittedAnyChunk) {
        throw new Error(`EMPTY_MODEL_RESPONSE: ${model} returned no text`);
      }

      return { model };
    } catch (err) {
      lastError = err;
      const hasNext = i < modelsToTry.length - 1;
      const willRetry = !emittedAnyChunk && shouldFallbackToNextModel(err) && hasNext;
      logServerAiError({
        stage: willRetry ? "stream_fallback_retry" : "stream_failed",
        endpoint,
        model,
        nextModel: willRetry ? modelsToTry[i + 1] : undefined,
        durationMs: Date.now() - startedAt,
        err,
      });
      if (willRetry) {
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("ALL_MODELS_UNAVAILABLE");
}

/**
 * Logs technical Gemini error details to console.error only, and returns
 * a friendly Portuguese message safe to show in the chat UI.
 */
export function formatFriendlyAiError(
  err: unknown,
  context?: { endpoint?: string; model?: string; durationMs?: number }
): {
  status: number;
  message: string;
  code: string;
  category: "auth" | "no_response" | "quota" | "unknown";
} {
  const raw = getErrorText(err);
  const lower = raw.toLowerCase();

  let result: {
    status: number;
    message: string;
    code: string;
    category: "auth" | "no_response" | "quota" | "unknown";
  };

  if (raw.includes("MISSING_API_KEY")) {
    result = {
      status: 503,
      code: "MISSING_API_KEY",
      category: "auth",
      message:
        "A IA ainda não está ativada neste ambiente. Configure a variável de ambiente GEMINI_API_KEY (na Vercel ou em Settings > Secrets) e faça um novo deploy.",
    };
  } else if (
    lower.includes("403") ||
    lower.includes("401") ||
    lower.includes("permission_denied") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("unauthenticated") ||
    lower.includes("unauthorized")
  ) {
    result = {
      status: 403,
      code: "INVALID_API_KEY",
      category: "auth",
      message:
        "Não foi possível autenticar a conexão com a IA. Verifique se a chave GEMINI_API_KEY está configurada corretamente.",
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
        "O modelo de IA demorou muito para responder. Tente reconectar em instantes.",
    };
  } else if (raw.includes("EMPTY_MODEL_RESPONSE")) {
    result = {
      status: 502,
      code: "EMPTY_MODEL_RESPONSE",
      category: "no_response",
      message:
        "O modelo de IA não retornou uma resposta válida desta vez. Tente reconectar em instantes.",
    };
  } else if (isModelNotFoundError(err) || raw.includes("ALL_MODELS_UNAVAILABLE")) {
    result = {
      status: 404,
      code: "MODEL_NOT_FOUND",
      category: "no_response",
      message:
        "Os modelos de IA estão temporariamente indisponíveis no momento. Tente reconectar em instantes.",
    };
  } else {
    result = {
      status: 500,
      code: "INTERNAL_ERROR",
      category: "no_response",
      message:
        "Não foi possível obter resposta da IA agora. Tente reconectar em instantes.",
    };
  }

  logServerAiError({
    stage: "formatted_response_error",
    endpoint: context?.endpoint,
    model: context?.model,
    status: result.status,
    code: result.code,
    category: result.category,
    durationMs: context?.durationMs,
    err,
  });

  return result;
}
