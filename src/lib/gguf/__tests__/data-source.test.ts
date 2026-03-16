import { BrowserFileDataSource } from "../data-source";

function createMockBlob(data: Uint8Array): Blob {
  return new Blob([data]);
}

describe("BrowserFileDataSource", () => {
  it("should read bytes sequentially", async () => {
    const data = new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x03, 0x00]);
    const blob = createMockBlob(data);
    const source = new BrowserFileDataSource(blob as File);

    const buf = new Uint8Array(4);
    const ok = await source.read(buf, 4);
    expect(ok).toBe(true);
    expect(buf).toEqual(new Uint8Array([0x47, 0x47, 0x55, 0x46]));
    expect(source.tell()).toBe(4);
  });

  it("should seek to position", async () => {
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    const source = new BrowserFileDataSource(createMockBlob(data) as File);

    await source.seek(2);
    expect(source.tell()).toBe(2);

    const buf = new Uint8Array(2);
    await source.read(buf, 2);
    expect(buf).toEqual(new Uint8Array([0x02, 0x03]));
  });

  it("should report eof when reading past end", async () => {
    const data = new Uint8Array([0x01]);
    const source = new BrowserFileDataSource(createMockBlob(data) as File);
    expect(source.eof()).toBe(false);

    const buf = new Uint8Array(10);
    const ok = await source.read(buf, 10);
    expect(ok).toBe(false);
    expect(source.eof()).toBe(true);
  });
});
