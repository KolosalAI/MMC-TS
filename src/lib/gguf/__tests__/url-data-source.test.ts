import { UrlDataSource } from "../url-data-source";

const originalFetch = globalThis.fetch;

describe("UrlDataSource", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should fetch range and read bytes", async () => {
    const mockData = new Uint8Array([
      0x47, 0x47, 0x55, 0x46, 0x03, 0x00, 0x00, 0x00,
    ]);
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 206,
      arrayBuffer: () => Promise.resolve(mockData.buffer),
    });

    const source = new UrlDataSource("https://example.com/model.gguf");
    const buf = new Uint8Array(4);
    const ok = await source.read(buf, 4);
    expect(ok).toBe(true);
    expect(buf).toEqual(new Uint8Array([0x47, 0x47, 0x55, 0x46]));
  });

  it("should abort on setAbortFlag", async () => {
    const source = new UrlDataSource("https://example.com/model.gguf");
    source.setAbortFlag();

    const buf = new Uint8Array(4);
    const ok = await source.read(buf, 4);
    expect(ok).toBe(false);
    expect(source.eof()).toBe(true);
  });
});
