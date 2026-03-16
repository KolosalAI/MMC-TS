import { GGUFType, GGUF_MAGIC, KVQ_BYTES } from "../types";

describe("GGUFType", () => {
  it("should have correct type values", () => {
    expect(GGUFType.UINT8).toBe(0);
    expect(GGUFType.STRING).toBe(8);
    expect(GGUFType.ARRAY).toBe(9);
    expect(GGUFType.FLOAT64).toBe(12);
    expect(GGUFType.MAX_TYPE).toBe(13);
  });

  it("should define correct GGUF magic number", () => {
    expect(GGUF_MAGIC).toBe(0x46554747);
  });

  it("should define correct KV quantization bytes per value", () => {
    expect(KVQ_BYTES.fp16).toBe(4.0);
    expect(KVQ_BYTES.fp32).toBe(8.0);
    expect(KVQ_BYTES.int8).toBe(2.0);
    expect(KVQ_BYTES.q6).toBe(1.5);
    expect(KVQ_BYTES.q5).toBe(1.25);
    expect(KVQ_BYTES.q4).toBe(1.0);
  });
});
