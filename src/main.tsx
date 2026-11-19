import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary, ThemeProvider } from "./components/ErrorBoundary";
import "./index.css";

declare global {
  interface Window {
    __PNF_MOUNTED__?: boolean;
    __PNF_RECOVER__?: (force?: boolean) => boolean;
  }
}

// Recover cleanly if Vite/Vercel serves a fresh build while an older chunk is requested
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  window.__PNF_RECOVER__?.(false);
});

// Clear stale Workbox precaches from earlier builds that cached old index.html/JS hashes
if ("caches" in window) {
  caches
    .keys()
    .then((keys) => {
      for (const key of keys) {
        if (key.includes("workbox-precache")) {
          void caches.delete(key);
        }
      }
    })
    .catch(() => {});
}

if ("serviceWorker" in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          void reg.unregister();
        }
      })
      .catch(() => {});
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

const rootEl = document.getElementById("root");
if (rootEl) {
  try {
    createRoot(rootEl).render(
      <ThemeProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ThemeProvider>
    );
    window.__PNF_MOUNTED__ = true;
    try {
      sessionStorage.removeItem("pnf_auto_recover_v1");
    } catch {
      // ignore storage errors
    }
  } catch (err) {
    console.error("Personal Nutri Fit mount error:", err);
    window.__PNF_RECOVER__?.(false);
  }
}
