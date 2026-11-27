import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildNutriSystemPrompt,
  buildPersonalSystemPrompt,
  ChatHistoryItem,
  DEFAULT_NUTRI_CONTEXT,
  DEFAULT_PERSONAL_CONTEXT,
  mapContents,
  NutriContext,
  PersonalContext,
} from "./server/aiPrompts.ts";
import {
  formatFriendlyAiError,
  GEMINI_MODELS,
  generateStreamWithFallback,
  hasGeminiApiKey,
} from "./server/gemini.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function streamGeminiResponse(
  res: express.Response,
  endpoint: "/api/ai/personal" | "/api/ai/nutri",
  systemInstruction: string,
  history: ChatHistoryItem[],
  message: string,
  preferredModel?: string
) {
  const startedAt = Date.now();
  if (!hasGeminiApiKey()) {
    const parsed = formatFriendlyAiError(new Error("MISSING_API_KEY"), {
      endpoint,
      model: preferredModel,
      durationMs: Date.now() - startedAt,
    });
    res.status(parsed.status).json({
      error: parsed.message,
      code: parsed.code,
      status: parsed.status,
      category: parsed.category,
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const { model: usedModel } = await generateStreamWithFallback(
      {
        preferredModel,
        contents: mapContents(history, message),
        config: {
          systemInstruction,
        },
      },
      (text) => {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      },
      endpoint
    );

    res.write(`data: ${JSON.stringify({ done: true, model: usedModel })}\n\n`);
    res.end();
  } catch (err) {
    const parsed = formatFriendlyAiError(err, {
      endpoint,
      model: preferredModel,
      durationMs: Date.now() - startedAt,
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
}

async function startServer() {
  const app = express();
  app.use((_req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  });
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, models: GEMINI_MODELS, aiConfigured: hasGeminiApiKey() });
  });

  app.post("/api/ai/personal", async (req, res) => {
    const { message, history, context, model } = req.body as {
      message?: string;
      history?: ChatHistoryItem[];
      context?: PersonalContext;
      model?: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: "Envie uma mensagem para o Personal IA." });
      return;
    }

    const systemPrompt = buildPersonalSystemPrompt(
      context || DEFAULT_PERSONAL_CONTEXT
    );

    await streamGeminiResponse(
      res,
      "/api/ai/personal",
      systemPrompt,
      history || [],
      message.trim(),
      model
    );
  });

  app.post("/api/ai/nutri", async (req, res) => {
    const { message, history, context, model } = req.body as {
      message?: string;
      history?: ChatHistoryItem[];
      context?: NutriContext;
      model?: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: "Envie uma mensagem para a Nutricionista IA." });
      return;
    }

    const systemPrompt = buildNutriSystemPrompt(
      context || DEFAULT_NUTRI_CONTEXT
    );

    await streamGeminiResponse(
      res,
      "/api/ai/nutri",
      systemPrompt,
      history || [],
      message.trim(),
      model
    );
  });

  const distPath = path.resolve(__dirname, "dist");
  const isProd = process.env.NODE_ENV === "production" && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Personal Nutri Fit server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
