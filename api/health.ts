import type { IncomingMessage, ServerResponse } from "node:http";

const GEMINI_MODELS = [
  "gemini-4-hydrogen",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
] as const;

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  const aiConfigured = Boolean(
    (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.API_KEY ||
      ""
    ).trim()
  );

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    JSON.stringify({
      ok: true,
      models: GEMINI_MODELS,
      aiConfigured,
    })
  );
}
