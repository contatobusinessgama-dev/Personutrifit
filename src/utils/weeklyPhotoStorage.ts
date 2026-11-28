export type PhotoAngle = "front" | "side" | "back";

export interface WeeklyPhotoRecord {
  id: string;
  weekLabel: string;
  date: string; // YYYY-MM-DD
  weightKg?: number;
  note?: string;
  photos: Partial<Record<PhotoAngle, string>>;
  updatedAt: string;
}

const DB_NAME = "personal_nutri_fit_weekly_photos_v1";
const STORE_NAME = "weekly_photo_records";
const FALLBACK_LS_KEY = "personal_nutri_fit_weekly_photos_fallback_v1";

/**
 * Compresses an uploaded body progress photo into a sharp JPEG Data URL
 * preserving its natural aspect ratio (max 960px on the longest side, ~80-150KB)
 * so full-body Frente/Lado/Costas photos remain crisp without exceeding browser storage.
 */
export async function compressProgressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem válido (JPG, PNG ou WebP).");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("A foto é muito grande. Escolha uma imagem de até 15 MB.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(new Error("Não foi possível ler o arquivo de imagem."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () =>
      reject(new Error("Não foi possível carregar a imagem selecionada."));
    el.src = dataUrl;
  });

  const maxSide = 960;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const targetWidth = Math.max(1, Math.round(img.width * scale));
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Navegador sem suporte para processamento de imagem.");
  }

  ctx.fillStyle = "#0B0B0D";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  let compressed = canvas.toDataURL("image/jpeg", 0.82);
  if (compressed.length > 260_000) {
    compressed = canvas.toDataURL("image/jpeg", 0.68);
  }
  return compressed;
}

function openPhotoDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readFallbackLocalStorage(): WeeklyPhotoRecord[] {
  try {
    const raw = window.localStorage.getItem(FALLBACK_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WeeklyPhotoRecord[]) : [];
  } catch {
    return [];
  }
}

function writeFallbackLocalStorage(records: WeeklyPhotoRecord[]): void {
  try {
    window.localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota errors in fallback mode
  }
}

export async function loadWeeklyPhotoRecords(): Promise<WeeklyPhotoRecord[]> {
  const db = await openPhotoDb();
  if (!db) {
    return readFallbackLocalStorage().sort((a, b) =>
      b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result)
          ? (req.result as WeeklyPhotoRecord[])
          : [];
        list.sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)
        );
        resolve(list);
      };
      req.onerror = () => resolve(readFallbackLocalStorage());
    } catch {
      resolve(readFallbackLocalStorage());
    }
  });
}

export async function saveWeeklyPhotoRecord(
  record: WeeklyPhotoRecord
): Promise<void> {
  const db = await openPhotoDb();
  if (!db) {
    const existing = readFallbackLocalStorage().filter((r) => r.id !== record.id);
    writeFallbackLocalStorage([record, ...existing]);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Erro ao salvar fotos."));
    } catch (err) {
      reject(err);
    }
  });
}

export async function deleteWeeklyPhotoRecord(id: string): Promise<void> {
  const db = await openPhotoDb();
  if (!db) {
    const existing = readFallbackLocalStorage().filter((r) => r.id !== id);
    writeFallbackLocalStorage(existing);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Erro ao remover semana."));
    } catch (err) {
      reject(err);
    }
  });
}
