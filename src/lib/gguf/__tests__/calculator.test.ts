import {
  calculateKVCacheBytes,
  calculateOverheadMB,
  formatMemorySize,
} from "../calculator";

describe("calculateKVCacheBytes", () => {
  it("should compute KV cache for standard MHA", () => {
    // kvq=4.0, hidden=4096, layers=32, ctx=8192, gqaRatio=1
    const bytes = calculateKVCacheBytes(4.0, 4096, 32, 8192, 1);
    expect(bytes).toBe(4.0 * 4096 * 32 * 8192 * 1);
    expect(bytes).toBe(4_294_967_296);
  });

  it("should apply GQA ratio correctly", () => {
    // kv_heads=8, attention_heads=32 → ratio=0.25
    const bytes = calculateKVCacheBytes(4.0, 4096, 32, 8192, 8 / 32);
    expect(bytes).toBe(4.0 * 4096 * 32 * 8192 * 0.25);
  });
});

describe("calculateOverheadMB", () => {
  it("should compute overhead for 13B model", () => {
    // 0.02 * 13 + 0.15 = 0.41 GB = 410 MB
    const mb = calculateOverheadMB(13_000_000_000);
    expect(mb).toBe(410);
  });

  it("should return 0 if no parameter count", () => {
    expect(calculateOverheadMB(undefined)).toBe(0);
  });
});

describe("formatMemorySize", () => {
  it("should format MB values under 1000", () => {
    expect(formatMemorySize(500)).toBe("500 MB");
  });

  it("should format GB values over 1000", () => {
    expect(formatMemorySize(15000)).toBe("15.0 GB");
  });
});
