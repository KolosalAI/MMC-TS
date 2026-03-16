export const GGUFType = {
  UINT8: 0,
  INT8: 1,
  UINT16: 2,
  INT16: 3,
  UINT32: 4,
  INT32: 5,
  FLOAT32: 6,
  BOOL: 7,
  STRING: 8,
  ARRAY: 9,
  UINT64: 10,
  INT64: 11,
  FLOAT64: 12,
  MAX_TYPE: 13,
} as const;

export type GGUFTypeValue = (typeof GGUFType)[keyof typeof GGUFType];

export const GGUF_MAGIC = 0x46554747;

export type KVQuantization = "fp32" | "fp16" | "int8" | "q6" | "q5" | "q4";

export const KVQ_BYTES: Record<KVQuantization, number> = {
  fp32: 8.0,
  fp16: 4.0,
  int8: 2.0,
  q6: 1.5,
  q5: 1.25,
  q4: 1.0,
};

export const KVQ_LABELS: Record<KVQuantization, string> = {
  fp32: "FP32 (8.0 bytes/value)",
  fp16: "FP16/BF16 (4.0 bytes/value)",
  int8: "INT8 (2.0 bytes/value)",
  q6: "Q6 (6-bit ≈ 1.5 bytes/value)",
  q5: "Q5 (5-bit ≈ 1.25 bytes/value)",
  q4: "Q4 (4-bit ≈ 1.0 bytes/value)",
};

export interface ModelParams {
  attention_heads: number;
  kv_heads: number;
  hidden_layers: number;
  hidden_size: number;
  split_count?: number;
  parameter_count?: number;
}

export interface MemoryUsage {
  modelSizeMB: number;
  kvCacheMB: number;
  overheadMB: number;
  totalRequiredMB: number;
  displayString: string;
  hasEstimate: boolean;
  kvq: string;
  gqaRatio: number;
}

export const CONTEXT_PRESETS = [
  { label: "1K", value: 1024 },
  { label: "2K", value: 2048 },
  { label: "4K", value: 4096 },
  { label: "8K", value: 8192 },
  { label: "16K", value: 16384 },
  { label: "32K", value: 32768 },
  { label: "64K", value: 65536 },
  { label: "128K", value: 131072 },
  { label: "256K", value: 262144 },
  { label: "512K", value: 524288 },
  { label: "1024K", value: 1048576 },
] as const;
