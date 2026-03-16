import { readModelParams } from "../parser";
import { GGUFType, GGUF_MAGIC } from "../types";

// Helper to build a minimal valid GGUF file buffer for testing
function buildGGUFBuffer(params: {
  attention_heads: number;
  kv_heads: number;
  block_count: number;
  embedding_length: number;
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
  function pushMetadataEntry(key: string, type: number, value: number) {
    pushString(key);
    pushU32(type);
    pushU32(value);
  }

  // Magic
  pushU32(GGUF_MAGIC);
  // Version
  pushU32(3);
  // Tensor count
  pushU64(0);
  // Metadata count (4 entries)
  pushU64(4);
  // Metadata entries
  pushMetadataEntry(
    "llama.attention.head_count",
    GGUFType.UINT32,
    params.attention_heads
  );
  pushMetadataEntry(
    "llama.attention.head_count_kv",
    GGUFType.UINT32,
    params.kv_heads
  );
  pushMetadataEntry(
    "llama.block_count",
    GGUFType.UINT32,
    params.block_count
  );
  pushMetadataEntry(
    "llama.embedding_length",
    GGUFType.UINT32,
    params.embedding_length
  );

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

describe("readModelParams", () => {
  it("should parse architecture params from a valid GGUF blob", async () => {
    const data = buildGGUFBuffer({
      attention_heads: 32,
      kv_heads: 8,
      block_count: 32,
      embedding_length: 4096,
    });
    const blob = new Blob([data]);
    const params = await readModelParams(blob as File);
    expect(params).not.toBeNull();
    expect(params!.attention_heads).toBe(32);
    expect(params!.kv_heads).toBe(8);
    expect(params!.hidden_layers).toBe(32);
    expect(params!.hidden_size).toBe(4096);
  });

  it("should return null for non-GGUF file", async () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const blob = new Blob([data]);
    const params = await readModelParams(blob as File);
    expect(params).toBeNull();
  });

  it("should fallback kv_heads to attention_heads when missing", async () => {
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
      const e = encoder.encode(s);
      pushU64(e.length);
      parts.push(e);
    }

    pushU32(0x46554747); // magic
    pushU32(3); // version
    pushU64(0); // tensor count
    pushU64(3); // metadata count (no kv_heads entry)
    // head_count
    pushString("llama.attention.head_count");
    pushU32(4);
    pushU32(32);
    // block_count
    pushString("llama.block_count");
    pushU32(4);
    pushU32(32);
    // embedding_length
    pushString("llama.embedding_length");
    pushU32(4);
    pushU32(4096);

    const totalLen = parts.reduce((s, p) => s + p.length, 0);
    const result = new Uint8Array(totalLen);
    let off = 0;
    for (const p of parts) {
      result.set(p, off);
      off += p.length;
    }

    const params = await readModelParams(new Blob([result]) as File);
    expect(params).not.toBeNull();
    expect(params!.kv_heads).toBe(32); // fallback to attention_heads
  });
});
