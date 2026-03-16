import { ModelParams } from "./types";
import { parseSplitInfoFromUrl, buildSplitUrl } from "./shards";

export async function getRemoteFileSize(
  url: string,
  options: {
    verbose?: boolean;
    logFn?: (...args: string[]) => void;
  } = {}
): Promise<number> {
  const { verbose = false, logFn } = options;
  const log = logFn || ((..._args: string[]) => {});

  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) {
      const cl = head.headers.get("content-length");
      if (cl) {
        const n = Number(cl);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  } catch (e) {
    if (verbose)
      log("[HEAD error]", e instanceof Error ? e.message : String(e));
  }

  // Fallback: attempt Range 0-0 to read Content-Range total
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-0" } });
    if (!res.ok && res.status !== 206 && res.status !== 200) return 0;
    const cr = res.headers.get("content-range");
    if (cr) {
      const m = cr.match(/\/(\d+)$/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
    const cl = res.headers.get("content-length");
    if (cl) {
      const n = Number(cl);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch (e) {
    if (verbose)
      log("[Range 0-0 error]", e instanceof Error ? e.message : String(e));
  }

  return 0;
}

export async function totalSplitSizeFromUrl(
  url: string,
  params: ModelParams | null,
  options: {
    verbose?: boolean;
    logFn?: (...args: string[]) => void;
  } = {}
): Promise<number | null> {
  const { verbose = false, logFn } = options;
  const log = logFn || ((..._args: string[]) => {});

  const info = parseSplitInfoFromUrl(url);
  const total =
    params?.split_count && params.split_count > 1
      ? params.split_count
      : info?.total || 0;
  if (!total || total <= 1) return null; // not split

  const width = info?.width || 5;
  const partUrls: string[] = [];

  if (info) {
    for (let i = 1; i <= total; i++)
      partUrls.push(buildSplitUrl(url, i, width));
  } else {
    const extIdx = url.lastIndexOf(".");
    const base = extIdx > -1 ? url.slice(0, extIdx) : url;
    const ext = extIdx > -1 ? url.slice(extIdx) : "";
    for (let i = 1; i <= total; i++) {
      const idxStr = String(i).padStart(width, "0");
      partUrls.push(
        `${base}-${idxStr}-of-${String(total).padStart(width, "0")}${ext}`
      );
    }
  }

  if (verbose) log(`[Split] Detected ${total} parts. Summing sizes...`);
  const sizes = await Promise.all(
    partUrls.map((u) => getRemoteFileSize(u, { verbose, logFn }))
  );
  if (sizes.some((s) => !s || s <= 0)) {
    if (verbose) log("[Split] Failed to resolve all part sizes.");
    return null;
  }
  return sizes.reduce((a, b) => a + b, 0);
}
