import { ChatMessage } from "../types";

/**
 * Active Gemini model rotation list (ordered by preference).
 * Deprecated models (such as gemini-2.0-flash) are excluded in favor of
 * currently supported Flash/Hydrogen models.
 */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-4-hydrogen",
] as const;

export type GeminiFallbackModel = (typeof GEMINI_FALLBACK_MODELS)[number];

export type AiErrorCategory = "auth" | "no_response" | "quota" | "http" | "unknown";

export type AiLoadingPhase = "idle" | "waiting" | "retrying" | "streaming";

export interface AiRetryInfo {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  model: string;
  nextModel: string;
  reason: string;
  code?: string;
  status?: number;
}

export interface FriendlyAiErrorOptions {
  status?: number;
  code?: string;
  category?: AiErrorCategory;
  endpoint?: string;
  model?: string;
  durationMs?: number;
  retryAfterMs?: number;
  attempts?: number;
  rawError?: unknown;
}

const AUTH_ERROR_CODES = new Set([
  "MISSING_API_KEY",
  "INVALID_API_KEY",
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "UNAUTHORIZED",
]);

const NO_RESPONSE_ERROR_CODES = new Set([
  "EMPTY_RESPONSE",
  "EMPTY_MODEL_RESPONSE",
  "TIMEOUT",
  "MODEL_TIMEOUT",
  "MODEL_NOT_FOUND",
  "ALL_MODELS_UNAVAILABLE",
  "NETWORK_ERROR",
  "STREAM_INTERRUPTED",
  "ENDPOINT_NOT_FOUND",
  "SERVER_FUNCTION_ERROR",
  "INTERNAL_ERROR",
]);

const RETRYABLE_ERROR_CODES = new Set([
  "TIMEOUT",
  "MODEL_TIMEOUT",
  "NETWORK_ERROR",
  "STREAM_INTERRUPTED",
  "EMPTY_RESPONSE",
  "EMPTY_MODEL_RESPONSE",
  "SERVER_FUNCTION_ERROR",
  "INTERNAL_ERROR",
  "QUOTA_EXHAUSTED",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
]);

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function classifyAiError(params: {
  status?: number;
  code?: string;
  category?: string;
  message?: string;
}): AiErrorCategory {
  if (
    params.category === "auth" ||
    params.category === "no_response" ||
    params.category === "quota" ||
    params.category === "http"
  ) {
    return params.category;
  }

  const code = (params.code || "").toUpperCase();
  const lower = (params.message || "").toLowerCase();

  if (
    params.status === 401 ||
    params.status === 403 ||
    AUTH_ERROR_CODES.has(code) ||
    lower.includes("missing_api_key") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("unauthenticated") ||
    lower.includes("permission_denied") ||
    lower.includes("unauthorized") ||
    lower.includes("chave da api") ||
    lower.includes("gemini_api_key")
  ) {
    return "auth";
  }

  if (
    params.status === 429 ||
    code === "QUOTA_EXHAUSTED" ||
    lower.includes("resource_exhausted") ||
    lower.includes("limite de uso") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    return "quota";
  }

  if (
    NO_RESPONSE_ERROR_CODES.has(code) ||
    params.status === 404 ||
    params.status === 500 ||
    params.status === 502 ||
    params.status === 503 ||
    params.status === 504 ||
    lower.includes("tempo limite") ||
    lower.includes("timeout") ||
    lower.includes("vazia") ||
    lower.includes("não retornou") ||
    lower.includes("interrompida") ||
    lower.includes("indisponível") ||
    lower.includes("indisponíveis") ||
    lower.includes("conectar ao servidor") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror")
  ) {
    return "no_response";
  }

  if (params.status && params.status >= 400) {
    return "http";
  }

  return "unknown";
}

export class FriendlyAiError extends Error {
  status?: number;
  code?: string;
  category: AiErrorCategory;
  endpoint?: string;
  model?: string;
  durationMs?: number;
  retryAfterMs?: number;
  attempts?: number;
  rawError?: unknown;

  constructor(message: string, options?: FriendlyAiErrorOptions) {
    super(message);
    this.name = "FriendlyAiError";
    this.status = options?.status;
    this.code = options?.code;
    this.endpoint = options?.endpoint;
    this.model = options?.model;
    this.durationMs = options?.durationMs;
    this.retryAfterMs = options?.retryAfterMs;
    this.attempts = options?.attempts;
    this.rawError = options?.rawError;
    this.category = classifyAiError({
      status: options?.status,
      code: options?.code,
      category: options?.category,
      message,
    });
  }
}

export function isAbortedAiError(err: unknown): boolean {
  if (err instanceof FriendlyAiError && err.code === "ABORTED") {
    return true;
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return true;
  }
  return err instanceof Error && err.name === "AbortError";
}

export function isRetryableAiError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted || isAbortedAiError(err)) {
    return false;
  }

  const friendly = err instanceof FriendlyAiError ? err : null;
  if (friendly) {
    if (friendly.category === "auth") return false;
    if (friendly.code === "ENDPOINT_NOT_FOUND") return false;
    if (
      friendly.status === 400 ||
      friendly.status === 401 ||
      friendly.status === 403 ||
      friendly.status === 422
    ) {
      return false;
    }
    if (friendly.status && RETRYABLE_HTTP_STATUSES.has(friendly.status)) {
      return true;
    }
    if (friendly.code && RETRYABLE_ERROR_CODES.has(friendly.code.toUpperCase())) {
      return true;
    }
    if (friendly.category === "quota" || friendly.category === "no_response") {
      return true;
    }
    return false;
  }

  const msg = err instanceof Error ? err.message.toLowerCase() : String(err || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("503") ||
    msg.includes("429")
  );
}

function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const trimmed = headerValue.trim();
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.round(seconds * 1000);
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    const diff = dateMs - Date.now();
    if (diff > 0) return diff;
  }
  return undefined;
}

export function computeBackoffDelayMs(
  retryIndex: number,
  baseDelayMs: number,
  maxDelayMs: number,
  retryAfterMs?: number
): number {
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(maxDelayMs, Math.max(baseDelayMs, retryAfterMs));
  }
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, retryIndex));
  // Equal/proportional jitter (±20%) to avoid synchronized thundering-herd retries
  const jitterFactor = 0.8 + Math.random() * 0.4;
  const jittered = Math.round((exponential * jitterFactor) / 50) * 50;
  return Math.min(maxDelayMs, Math.max(300, jittered));
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new FriendlyAiError("Requisição cancelada.", { code: "ABORTED" }));
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timerId);
      reject(new FriendlyAiError("Requisição cancelada.", { code: "ABORTED" }));
    };

    const timerId = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function describeRetryReason(err: unknown): string {
  const friendly = err instanceof FriendlyAiError ? err : null;
  const code = (friendly?.code || "").toUpperCase();
  if (friendly?.status === 429 || friendly?.category === "quota" || code === "QUOTA_EXHAUSTED") {
    return "limite temporário de requisições";
  }
  if (code === "TIMEOUT" || code === "MODEL_TIMEOUT" || friendly?.status === 408) {
    return "tempo limite excedido";
  }
  if (code === "NETWORK_ERROR") {
    return "oscilação de conexão";
  }
  if (code === "STREAM_INTERRUPTED") {
    return "transmissão interrompida";
  }
  if (code === "EMPTY_RESPONSE" || code === "EMPTY_MODEL_RESPONSE") {
    return "resposta vazia do servidor";
  }
  if (friendly?.status && friendly.status >= 500) {
    return "servidor temporariamente ocupado";
  }
  return "instabilidade temporária";
}

export interface AiErrorLogDetails {
  stage: string;
  endpoint: string;
  model?: string;
  nextModel?: string;
  status?: number;
  code?: string;
  category: AiErrorCategory;
  durationMs: number;
  attempts?: number;
  historyCount: number;
  messagePreview: string;
  friendlyMessage: string;
  rawMessage?: string;
  responsePreview?: string;
  originalError?: unknown;
}

export function logAiApiError(details: AiErrorLogDetails): void {
  const isOnline =
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : undefined;

  console.error(`[Bianco Fit AI API Error] ${details.endpoint} (${details.stage})`, {
    timestamp: new Date().toISOString(),
    endpoint: details.endpoint,
    stage: details.stage,
    model: details.model,
    nextModel: details.nextModel,
    status: details.status,
    code: details.code,
    category: details.category,
    durationMs: details.durationMs,
    attempts: details.attempts,
    online: isOnline,
    historyCount: details.historyCount,
    messagePreview: details.messagePreview,
    friendlyMessage: details.friendlyMessage,
    rawMessage: details.rawMessage,
    responsePreview: details.responsePreview,
    originalError: details.originalError,
  });
}

export const AI_TEMPORARILY_UNAVAILABLE_TOAST =
  "A IA está temporariamente indisponível. Tente reconectar para enviar sua mensagem novamente.";

export interface AiToastNotification {
  message: string;
  category: AiErrorCategory;
  isUnavailable: boolean;
  actionLabel: string;
}

/**
 * Produces the friendly Dashboard Toast message and reconnect CTA for AI errors.
 * Any authentication failure or missing model response triggers the standardized
 * "A IA está temporariamente indisponível" notice with a reconnect suggestion.
 */
export function getAiToastNotification(err: unknown): AiToastNotification {
  const friendly = err instanceof FriendlyAiError ? err : null;
  const category =
    friendly?.category ??
    classifyAiError({
      message: err instanceof Error ? err.message : String(err || ""),
    });

  if (category === "auth" && friendly?.message) {
    return {
      message: friendly.message,
      category,
      isUnavailable: true,
      actionLabel: "Tentar novamente",
    };
  }

  if (category === "auth" || category === "no_response" || category === "unknown") {
    return {
      message: AI_TEMPORARILY_UNAVAILABLE_TOAST,
      category,
      isUnavailable: true,
      actionLabel: "Reconectar",
    };
  }

  return {
    message:
      friendly?.message ||
      AI_TEMPORARILY_UNAVAILABLE_TOAST,
    category,
    isUnavailable: false,
    actionLabel: "Tentar novamente",
  };
}

export interface GenerateWithFallbackParams {
  endpoint: "/api/ai/personal" | "/api/ai/nutri";
  message: string;
  history: ChatMessage[];
  context: Record<string, unknown>;
  onChunk?: (fullText: string) => void;
  onRetry?: (info: AiRetryInfo) => void;
  onStateChange?: (phase: AiLoadingPhase, retryInfo?: AiRetryInfo | null) => void;
  signal?: AbortSignal;
  models?: readonly string[];
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function isModelNotFoundSignal(status?: number, code?: string, message?: string): boolean {
  if (code === "MODEL_NOT_FOUND") return true;
  if (code === "ENDPOINT_NOT_FOUND") return false;
  const lower = (message || "").toLowerCase();
  if (
    lower.includes("not_found") ||
    lower.includes("model not found") ||
    lower.includes("no longer available")
  ) {
    return true;
  }
  return status === 404 && lower.includes("modelo");
}

const CLIENT_REQUEST_TIMEOUT_MS = 35000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 900;
const DEFAULT_MAX_DELAY_MS = 8000;

async function requestStreamForModel(
  params: GenerateWithFallbackParams,
  model: string
): Promise<string> {
  if (params.signal?.aborted) {
    throw new FriendlyAiError("Requisição cancelada.", {
      code: "ABORTED",
      endpoint: params.endpoint,
      model,
    });
  }

  const startedAt = Date.now();
  const messagePreview = params.message.trim().slice(0, 120);
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (params.signal) {
    params.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CLIENT_REQUEST_TIMEOUT_MS);

  const cleanHistory = params.history
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  let response: Response;
  try {
    response = await fetch(params.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify({
        model,
        message: params.message,
        history: cleanHistory,
        context: params.context,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    window.clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", onExternalAbort);
    const durationMs = Date.now() - startedAt;

    if (params.signal?.aborted && !timedOut) {
      throw new FriendlyAiError("Requisição cancelada.", {
        code: "ABORTED",
        endpoint: params.endpoint,
        model,
        durationMs,
        rawError: err,
      });
    }

    const code = timedOut ? "TIMEOUT" : "NETWORK_ERROR";
    const friendlyMessage = timedOut
      ? "A resposta da IA demorou mais que o esperado (tempo limite atingido). Tente reconectar."
      : "Não foi possível conectar ao servidor da IA. Verifique sua conexão e tente reconectar.";

    logAiApiError({
      stage: timedOut ? "fetch_timeout" : "fetch_network_error",
      endpoint: params.endpoint,
      model,
      code,
      category: "no_response",
      durationMs,
      historyCount: cleanHistory.length,
      messagePreview,
      friendlyMessage,
      rawMessage: err instanceof Error ? err.message : String(err),
      originalError: err,
    });

    throw new FriendlyAiError(friendlyMessage, {
      code,
      category: "no_response",
      endpoint: params.endpoint,
      model,
      durationMs,
      rawError: err,
    });
  }

  if (!response.ok) {
    window.clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", onExternalAbort);
    const durationMs = Date.now() - startedAt;
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));

    let errorMessage =
      "Não foi possível consultar a IA no momento. Tente reconectar em alguns segundos.";
    let errorCode: string | undefined;
    let errorCategory: string | undefined;
    let rawPreview: string | undefined;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        const errData = (await response.json()) as {
          error?: string;
          code?: string;
          category?: string;
        };
        if (errData.error) errorMessage = errData.error;
        if (errData.code) errorCode = errData.code;
        if (errData.category) errorCategory = errData.category;
        rawPreview = JSON.stringify(errData).slice(0, 300);
      } catch (parseErr) {
        logAiApiError({
          stage: "http_error_json_parse_failed",
          endpoint: params.endpoint,
          model,
          status: response.status,
          code: "INVALID_JSON_ERROR_RESPONSE",
          category: classifyAiError({ status: response.status }),
          durationMs,
          historyCount: cleanHistory.length,
          messagePreview,
          friendlyMessage: errorMessage,
          rawMessage: parseErr instanceof Error ? parseErr.message : String(parseErr),
          originalError: parseErr,
        });
      }
    } else {
      let rawText = "";
      try {
        rawText = (await response.text()).slice(0, 300);
      } catch {
        // ignore text read failure
      }
      rawPreview = rawText;

      if (response.status === 401 || response.status === 403) {
        errorCode = "INVALID_API_KEY";
        errorMessage =
          "Falha de autenticação com o serviço de IA. Verifique as credenciais e tente reconectar.";
      } else if (response.status === 404) {
        errorCode = "ENDPOINT_NOT_FOUND";
        errorMessage =
          "O serviço de IA não está disponível neste domínio (/api/ai indisponível). Tente reconectar mais tarde.";
      } else if (
        response.status >= 500 ||
        rawText.includes("FUNCTION_INVOCATION_FAILED")
      ) {
        errorCode = "SERVER_FUNCTION_ERROR";
        errorMessage =
          "Erro interno no servidor de IA. Tente reconectar em alguns instantes.";
      }
    }

    const category = classifyAiError({
      status: response.status,
      code: errorCode,
      category: errorCategory,
      message: errorMessage,
    });

    logAiApiError({
      stage: "http_non_2xx",
      endpoint: params.endpoint,
      model,
      status: response.status,
      code: errorCode,
      category,
      durationMs,
      historyCount: cleanHistory.length,
      messagePreview,
      friendlyMessage: errorMessage,
      responsePreview: rawPreview,
    });

    throw new FriendlyAiError(errorMessage, {
      status: response.status,
      code: errorCode,
      category,
      endpoint: params.endpoint,
      model,
      durationMs,
      retryAfterMs,
    });
  }

  if (!response.body) {
    window.clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", onExternalAbort);
    const durationMs = Date.now() - startedAt;
    const friendlyMessage =
      "A resposta da IA veio vazia. Tente reconectar para enviar sua mensagem novamente.";

    logAiApiError({
      stage: "empty_response_body",
      endpoint: params.endpoint,
      model,
      status: response.status,
      code: "EMPTY_RESPONSE",
      category: "no_response",
      durationMs,
      historyCount: cleanHistory.length,
      messagePreview,
      friendlyMessage,
    });

    throw new FriendlyAiError(friendlyMessage, {
      status: response.status,
      code: "EMPTY_RESPONSE",
      category: "no_response",
      endpoint: params.endpoint,
      model,
      durationMs,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let accumulated = "";
  let hasReceivedChunk = false;

  const processEventBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      let parsed: {
        text?: string;
        done?: boolean;
        error?: string;
        code?: string;
        status?: number;
        category?: string;
      };
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      if (parsed.error) {
        const durationMs = Date.now() - startedAt;
        const sseStatus =
          parsed.status ?? (parsed.code === "MODEL_NOT_FOUND" ? 404 : undefined);
        const category = classifyAiError({
          status: sseStatus,
          code: parsed.code,
          category: parsed.category,
          message: parsed.error,
        });

        logAiApiError({
          stage: "sse_error_event",
          endpoint: params.endpoint,
          model,
          status: sseStatus,
          code: parsed.code,
          category,
          durationMs,
          historyCount: cleanHistory.length,
          messagePreview,
          friendlyMessage: parsed.error,
          responsePreview: jsonStr.slice(0, 300),
        });

        throw new FriendlyAiError(parsed.error, {
          status: sseStatus,
          code: parsed.code,
          category,
          endpoint: params.endpoint,
          model,
          durationMs,
        });
      }
      if (parsed.text) {
        if (!hasReceivedChunk) {
          hasReceivedChunk = true;
          params.onStateChange?.("streaming", null);
        }
        accumulated += parsed.text;
        params.onChunk?.(accumulated);
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) {
          processEventBlock(buffer);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";

      for (const evt of events) {
        if (evt.trim()) {
          processEventBlock(evt);
        }
      }
    }
  } catch (err) {
    if (err instanceof FriendlyAiError) {
      throw err;
    }
    const durationMs = Date.now() - startedAt;

    if (params.signal?.aborted && !timedOut) {
      throw new FriendlyAiError("Requisição cancelada.", {
        code: "ABORTED",
        endpoint: params.endpoint,
        model,
        durationMs,
        rawError: err,
      });
    }

    const code = timedOut ? "TIMEOUT" : "STREAM_INTERRUPTED";
    const friendlyMessage = timedOut
      ? "A conexão com a IA excedeu o tempo limite. Tente reconectar."
      : "A conexão com a IA foi interrompida antes da resposta. Tente reconectar.";

    logAiApiError({
      stage: timedOut ? "stream_timeout" : "stream_interrupted",
      endpoint: params.endpoint,
      model,
      code,
      category: "no_response",
      durationMs,
      historyCount: cleanHistory.length,
      messagePreview,
      friendlyMessage,
      rawMessage: err instanceof Error ? err.message : String(err),
      originalError: err,
    });

    throw new FriendlyAiError(friendlyMessage, {
      code,
      category: "no_response",
      endpoint: params.endpoint,
      model,
      durationMs,
      rawError: err,
    });
  } finally {
    window.clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", onExternalAbort);
  }

  if (!accumulated.trim()) {
    const durationMs = Date.now() - startedAt;
    const friendlyMessage =
      "A IA não retornou conteúdo desta vez. Tente reconectar para enviar sua pergunta novamente.";

    logAiApiError({
      stage: "empty_accumulated_response",
      endpoint: params.endpoint,
      model,
      status: response.status,
      code: "EMPTY_RESPONSE",
      category: "no_response",
      durationMs,
      historyCount: cleanHistory.length,
      messagePreview,
      friendlyMessage,
    });

    throw new FriendlyAiError(friendlyMessage, {
      status: response.status,
      code: "EMPTY_RESPONSE",
      category: "no_response",
      endpoint: params.endpoint,
      model,
      durationMs,
    });
  }

  return accumulated;
}

/**
 * Generates an AI chat response via the server-side Gemini proxy with:
 * 1. Immediate model rotation on 404 / model-not-found signals.
 * 2. Intelligent exponential backoff retry with jitter (plus Retry-After support)
 *    for transient failures (429, 5xx, network errors, timeouts, empty/interrupted streams).
 * 3. Explicit loading phase notifications ("waiting" | "retrying" | "streaming").
 */
export async function generateWithFallback(
  params: GenerateWithFallbackParams
): Promise<string> {
  const rotation =
    params.models && params.models.length > 0 ? params.models : GEMINI_FALLBACK_MODELS;
  const maxRetries = Math.max(0, params.maxRetries ?? DEFAULT_MAX_RETRIES);
  const baseDelayMs = Math.max(250, params.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  const maxDelayMs = Math.max(baseDelayMs, params.maxDelayMs ?? DEFAULT_MAX_DELAY_MS);
  const startedAt = Date.now();
  const messagePreview = params.message.trim().slice(0, 120);

  let modelIndex = 0;
  let retryCount = 0;
  let totalAttempts = 0;
  const unavailableModels = new Set<string>();

  while (true) {
    if (params.signal?.aborted) {
      throw new FriendlyAiError("Requisição cancelada.", {
        code: "ABORTED",
        endpoint: params.endpoint,
        durationMs: Date.now() - startedAt,
        attempts: totalAttempts,
      });
    }

    const model = rotation[modelIndex];
    totalAttempts += 1;
    params.onStateChange?.("waiting", null);

    try {
      return await requestStreamForModel(params, model);
    } catch (err) {
      if (isAbortedAiError(err) || params.signal?.aborted) {
        throw err;
      }

      const friendly = err instanceof FriendlyAiError ? err : null;
      const is404Model = isModelNotFoundSignal(
        friendly?.status,
        friendly?.code,
        err instanceof Error ? err.message : String(err)
      );

      // 1. Immediate model rotation when a model is deprecated/not found
      if (is404Model) {
        unavailableModels.add(model);
        const nextAvailableIdx = rotation.findIndex((m) => !unavailableModels.has(m));
        if (nextAvailableIdx !== -1) {
          const nextModel = rotation[nextAvailableIdx];
          logAiApiError({
            stage: "client_model_fallback_retry",
            endpoint: params.endpoint,
            model,
            nextModel,
            status: friendly?.status ?? 404,
            code: friendly?.code ?? "MODEL_NOT_FOUND",
            category: "no_response",
            durationMs: Date.now() - startedAt,
            attempts: totalAttempts,
            historyCount: params.history.length,
            messagePreview,
            friendlyMessage: friendly?.message || "Modelo indisponível, rotacionando...",
            originalError: err,
          });
          modelIndex = nextAvailableIdx;
          continue;
        }

        const durationMs = Date.now() - startedAt;
        const exhaustedMsg =
          "Os modelos de IA estão temporariamente indisponíveis. Tente reconectar em alguns instantes.";
        logAiApiError({
          stage: "client_all_models_exhausted",
          endpoint: params.endpoint,
          code: "ALL_MODELS_UNAVAILABLE",
          category: "no_response",
          durationMs,
          attempts: totalAttempts,
          historyCount: params.history.length,
          messagePreview,
          friendlyMessage: exhaustedMsg,
          originalError: err,
        });

        throw new FriendlyAiError(exhaustedMsg, {
          code: "ALL_MODELS_UNAVAILABLE",
          category: "no_response",
          endpoint: params.endpoint,
          durationMs,
          attempts: totalAttempts,
          rawError: err,
        });
      }

      // 2. Intelligent exponential backoff retry for transient failures
      if (isRetryableAiError(err, params.signal) && retryCount < maxRetries) {
        const delayMs = computeBackoffDelayMs(
          retryCount,
          baseDelayMs,
          maxDelayMs,
          friendly?.retryAfterMs
        );
        retryCount += 1;

        // Rotate to the next available sibling model on retry for extra resilience
        const availableModels = rotation.filter((m) => !unavailableModels.has(m));
        let nextModelIndex = modelIndex;
        if (availableModels.length > 1) {
          for (let step = 1; step <= rotation.length; step++) {
            const candidateIdx = (modelIndex + step) % rotation.length;
            if (!unavailableModels.has(rotation[candidateIdx])) {
              nextModelIndex = candidateIdx;
              break;
            }
          }
        }
        const nextModel = rotation[nextModelIndex];

        const retryInfo: AiRetryInfo = {
          attempt: retryCount,
          maxRetries,
          delayMs,
          model,
          nextModel,
          reason: describeRetryReason(err),
          code: friendly?.code,
          status: friendly?.status,
        };

        console.warn("[Bianco Fit AI Retry] Nova tentativa agendada (backoff exponencial):", {
          timestamp: new Date().toISOString(),
          endpoint: params.endpoint,
          attempt: retryInfo.attempt,
          maxRetries: retryInfo.maxRetries,
          delayMs: retryInfo.delayMs,
          failedModel: model,
          nextModel,
          reason: retryInfo.reason,
          status: friendly?.status,
          code: friendly?.code,
        });

        // Clear any partial chunk before retrying so the bubble displays the typing/retry indicator cleanly
        params.onChunk?.("");
        params.onRetry?.(retryInfo);
        params.onStateChange?.("retrying", retryInfo);

        await sleepWithAbort(delayMs, params.signal);

        modelIndex = nextModelIndex;
        continue;
      }

      // 3. Non-retryable error or retries exhausted
      if (friendly) {
        friendly.attempts = totalAttempts;
        friendly.durationMs = Date.now() - startedAt;
      }

      if (retryCount > 0) {
        logAiApiError({
          stage: "client_retries_exhausted",
          endpoint: params.endpoint,
          model,
          status: friendly?.status,
          code: friendly?.code,
          category: friendly?.category ?? "unknown",
          durationMs: Date.now() - startedAt,
          attempts: totalAttempts,
          historyCount: params.history.length,
          messagePreview,
          friendlyMessage:
            friendly?.message ||
            "Não foi possível obter resposta da IA após múltiplas tentativas.",
          originalError: err,
        });
      }

      throw err;
    }
  }
}
