/**
 * Compresses an uploaded image File into a square 160x160 JPEG Data URL
 * small enough (< 30KB) for both localStorage and Firestore storage.
 */
export async function compressAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem válido (JPG, PNG ou WebP).");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("A imagem é muito grande. Escolha uma foto de até 10 MB.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo de imagem."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Não foi possível carregar a imagem selecionada."));
    el.src = dataUrl;
  });

  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Navegador sem suporte a processamento de imagem.");
  }

  // Center-crop square
  const minDim = Math.min(img.width, img.height);
  const sx = (img.width - minDim) / 2;
  const sy = (img.height - minDim) / 2;

  ctx.fillStyle = "#0B0B0D";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

  const compressed = canvas.toDataURL("image/jpeg", 0.78);
  if (compressed.length > 60000) {
    return canvas.toDataURL("image/jpeg", 0.55);
  }
  return compressed;
}
