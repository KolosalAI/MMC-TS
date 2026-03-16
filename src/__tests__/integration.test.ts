import { readModelParams } from "../lib/gguf/parser";
import { computeMemoryUsage } from "../lib/gguf/calculator";
import { GGUFType, GGUF_MAGIC } from "../lib/gguf/types";

function buildGGUFBuffer(params: {
  attention_heads: number;
  kv_heads: number;
  block_count: number;
  embedding_length: number;
  parameter_count?: number;
}): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  function pushU32(v: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, true);
    parts.push(b);
  }
  function pushU64(v: number) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigUint64(0, BigInt(v), true);
    parts.push(b);
  }
  function pushString(s: string) {
    const encoded = encoder.encode(s);
    pushU64(encoded.length);
    parts.push(encoded);
  }

  const metadataCount = params.parameter_count ? 5 : 4;

  pushU32(GGUF_MAGIC);
  pushU32(3);
  pushU64(0);
  pushU64(metadataCount);

  // parameter_count (optional, stored as UINT64) — must come before
  // the required fields so the parser reads it before early-exit
  if (params.parameter_count) {
    pushString("general.parameter_count");
    pushU32(GGUFType.UINT64);
    pushU64(params.parameter_count);
  }

  // attention.head_count
  pushString("llama.attention.head_count");
  pushU32(GGUFType.UINT32);
  pushU32(params.attention_heads);

  // attention.head_count_kv
  pushString("llama.attention.head_count_kv");
  pushU32(GGUFType.UINT32);
  pushU32(params.kv_heads);

  // block_count
  pushString("llama.block_count");
  pushU32(GGUFType.UINT32);
  pushU32(params.block_count);

  // embedding_length
  pushString("llama.embedding_length");
  pushU32(GGUFType.UINT32);
  pushU32(params.embedding_length);

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

describe("Integration: GGUF parse → memory calculation", () => {
  it("should compute correct memory for a 13B-style model at 8K context", async () => {
    const data = buildGGUFBuffer({
      attention_heads: 40,
      kv_heads: 40,
      block_count: 40,
      embedding_length: 5120,
      parameter_count: 13_000_000_000,
    });

    const blob = new Blob([data]);
    const params = await readModelParams(blob as File);
    expect(params).not.toBeNull();

    // Simulate a 15 GB model file
    const modelFileSize = 15_000_000_000;
    const usage = computeMemoryUsage(params!, modelFileSize, 8192, "fp16");

    expect(usage.modelSizeMB).toBe(15000);
    // KV: 4.0 * 5120 * 40 * 8192 * 1 = 6,710,886,400 bytes = 6710 MB
    expect(usage.kvCacheMB).toBe(6710);
    // Overhead: 0.02 * 13 + 0.15 = 0.41 GB = 410 MB
    expect(usage.overheadMB).toBe(410);
    expect(usage.totalRequiredMB).toBe(15000 + 6710 + 410);
    expect(usage.hasEstimate).toBe(true);
    expect(usage.gqaRatio).toBe(1);
  });

  it("should compute correct memory with GQA (kv_heads < attention_heads)", async () => {
    const data = buildGGUFBuffer({
      attention_heads: 32,
      kv_heads: 8,
      block_count: 32,
      embedding_length: 4096,
    });

    const blob = new Blob([data]);
    const params = await readModelParams(blob as File);
    expect(params).not.toBeNull();

    const modelFileSize = 8_000_000_000;
    const usage = computeMemoryUsage(params!, modelFileSize, 4096, "fp16");

    expect(usage.gqaRatio).toBe(0.25);
    // KV: 4.0 * 4096 * 32 * 4096 * 0.25 = 536,870,912 bytes = 536 MB
    expect(usage.kvCacheMB).toBe(536);
    expect(usage.modelSizeMB).toBe(8000);
    expect(usage.overheadMB).toBe(0); // no parameter_count
    expect(usage.totalRequiredMB).toBe(8000 + 536);
  });

  it("should handle Q4 KV quantization", async () => {
    const data = buildGGUFBuffer({
      attention_heads: 32,
      kv_heads: 32,
      block_count: 32,
      embedding_length: 4096,
    });

    const blob = new Blob([data]);
    const params = await readModelParams(blob as File);
    expect(params).not.toBeNull();

    const usage = computeMemoryUsage(params!, 7_000_000_000, 8192, "q4");

    // KV: 1.0 * 4096 * 32 * 8192 * 1 = 1,073,741,824 bytes = 1073 MB
    expect(usage.kvCacheMB).toBe(1073);
    expect(usage.kvq).toBe("Q4 (4-bit ≈ 1.0 bytes/value)");
  });
});
