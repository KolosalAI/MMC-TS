import {
  KVQuantization,
  KVQ_BYTES,
  KVQ_LABELS,
  ModelParams,
  MemoryUsage,
} from "./types";

export function calculateKVCacheBytes(
  kvqBytesPerValue: number,
  hiddenSize: number,
  hiddenLayers: number,
  contextSize: number,
  gqaRatio: number
): number {
  return kvqBytesPerValue * hiddenSize * hiddenLayers * contextSize * gqaRatio;
}

export function calculateOverheadMB(
  parameterCount: number | undefined
): number {
  if (!parameterCount) return 0;
  const paramsBillion = parameterCount / 1_000_000_000;
  const overheadGB = 0.02 * paramsBillion + 0.15;
  return Math.floor(overheadGB * 1000);
}

export function formatMemorySize(mb: number): string {
  const n = Number(mb);
  if (n >= 1000) return (n / 1000).toFixed(1) + " GB";
  return n + " MB";
}

export function computeMemoryUsage(
  params: ModelParams,
  totalSizeBytes: number,
  contextSize: number,
  kvQuantization: KVQuantization
): MemoryUsage {
  const modelSizeMB = Math.floor(totalSizeBytes / 1_000_000);
  const kvqBytesPerValue = KVQ_BYTES[kvQuantization];
  const gqaRatio =
    params.kv_heads && params.attention_heads
      ? params.kv_heads / params.attention_heads
      : 1;
  const kvBytes = calculateKVCacheBytes(
    kvqBytesPerValue,
    params.hidden_size,
    params.hidden_layers,
    contextSize,
    gqaRatio
  );
  const kvCacheMB = Math.floor(kvBytes / 1_000_000);
  const overheadMB = calculateOverheadMB(params.parameter_count);
  const totalRequiredMB = modelSizeMB + kvCacheMB + overheadMB;
  const displayString = `${formatMemorySize(totalRequiredMB)} (Model: ${formatMemorySize(modelSizeMB)} + KV: ${formatMemorySize(kvCacheMB)} + Overhead: ${formatMemorySize(overheadMB)})`;

  return {
    modelSizeMB,
    kvCacheMB,
    overheadMB,
    totalRequiredMB,
    displayString,
    hasEstimate: true,
    kvq: KVQ_LABELS[kvQuantization],
    gqaRatio,
  };
}
