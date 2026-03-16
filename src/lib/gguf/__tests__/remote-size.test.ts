import { getRemoteFileSize } from "../remote-size";

const originalFetch = globalThis.fetch;

describe("getRemoteFileSize", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should return size from HEAD Content-Length", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-length": "15000000000" }),
    });

    const size = await getRemoteFileSize("https://example.com/model.gguf");
    expect(size).toBe(15000000000);
  });

  it("should fallback to Range Content-Range", async () => {
    let callCount = 0;
    globalThis.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // HEAD fails
        return Promise.resolve({
          ok: false,
          headers: new Headers(),
        });
      }
      // Range 0-0 returns Content-Range
      return Promise.resolve({
        ok: true,
        status: 206,
        headers: new Headers({
          "content-range": "bytes 0-0/5000000000",
        }),
      });
    });

    const size = await getRemoteFileSize("https://example.com/model.gguf");
    expect(size).toBe(5000000000);
  });

  it("should return 0 if all methods fail", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    const size = await getRemoteFileSize("https://example.com/model.gguf");
    expect(size).toBe(0);
  });
});
