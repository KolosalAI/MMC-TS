import {
  parseSplitInfoFromUrl,
  buildSplitUrl,
  normalizeHuggingFaceUrl,
} from "../shards";

describe("parseSplitInfoFromUrl", () => {
  it("should parse split info from sharded URL", () => {
    const url = "https://hf.co/model-00003-of-00013.gguf";
    const info = parseSplitInfoFromUrl(url);
    expect(info).not.toBeNull();
    expect(info!.index).toBe(3);
    expect(info!.total).toBe(13);
    expect(info!.width).toBe(5);
  });

  it("should return null for non-sharded URL", () => {
    expect(
      parseSplitInfoFromUrl("https://hf.co/model.gguf")
    ).toBeNull();
  });
});

describe("buildSplitUrl", () => {
  it("should replace shard index in URL", () => {
    const url = "https://hf.co/model-00003-of-00013.gguf";
    expect(buildSplitUrl(url, 1, 5)).toBe(
      "https://hf.co/model-00001-of-00013.gguf"
    );
  });
});

describe("normalizeHuggingFaceUrl", () => {
  it("should convert /blob/ to /resolve/", () => {
    const url =
      "https://huggingface.co/user/model/blob/main/file.gguf";
    expect(normalizeHuggingFaceUrl(url)).toBe(
      "https://huggingface.co/user/model/resolve/main/file.gguf"
    );
  });

  it("should strip ?download=1", () => {
    const url =
      "https://huggingface.co/user/model/resolve/main/file.gguf?download=1";
    expect(normalizeHuggingFaceUrl(url)).toBe(
      "https://huggingface.co/user/model/resolve/main/file.gguf"
    );
  });

  it("should not modify non-HF URLs", () => {
    const url = "https://example.com/model.gguf";
    expect(normalizeHuggingFaceUrl(url)).toBe(url);
  });
});
