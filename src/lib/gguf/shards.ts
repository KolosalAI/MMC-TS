export interface SplitInfo {
  index: number;
  total: number;
  width: number;
}

export function parseSplitInfoFromUrl(url: string): SplitInfo | null {
  const re = /-(\d{2,})-of-(\d{2,})(?=\.|$)/;
  const m = url.match(re);
  if (!m) return null;
  const idxStr = m[1];
  const totalStr = m[2];
  const width = idxStr.length;
  const index = Number(idxStr);
  const total = Number(totalStr);
  if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0)
    return null;
  return { index, total, width };
}

export function buildSplitUrl(
  url: string,
  newIndex: number,
  width: number
): string {
  const idxStr = String(newIndex).padStart(width, "0");
  return url.replace(
    /-(\d{2,})-of-(\d{2,})(?=\.|$)/,
    `-${idxStr}-of-$2`
  );
}

export function normalizeHuggingFaceUrl(u: string): string {
  if (!u || typeof u !== "string") return u;
  if (!u.includes("huggingface.co/")) return u;
  let updated = u.replace(/\/blob\//, "/resolve/");
  updated = updated.replace(/\?raw=1|\?download=1|\?raw=true/i, "");
  if (!/\.gguf($|[?#])/.test(updated)) return u;
  return updated;
}
