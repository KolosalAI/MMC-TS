import { readUIntLE, readU32, readU64, readString } from "../binary";
import { BrowserFileDataSource } from "../data-source";

describe("readUIntLE", () => {
  it("should read 4-byte little-endian uint", () => {
    const buf = new Uint8Array([0x47, 0x47, 0x55, 0x46]);
    expect(readUIntLE(buf, 0, 4)).toBe(0x46554747n);
  });

  it("should read 8-byte little-endian uint", () => {
    const buf = new Uint8Array([
      0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(readUIntLE(buf, 0, 8)).toBe(3n);
  });
});

describe("readU32", () => {
  it("should read uint32 from source", async () => {
    const data = new Uint8Array([0x03, 0x00, 0x00, 0x00]);
    const source = new BrowserFileDataSource(new Blob([data]) as File);
    expect(await readU32(source)).toBe(3);
  });
});

describe("readU64", () => {
  it("should read uint64 from source", async () => {
    const data = new Uint8Array([
      0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const source = new BrowserFileDataSource(new Blob([data]) as File);
    expect(await readU64(source)).toBe(32);
  });
});

describe("readString", () => {
  it("should read length-prefixed string", async () => {
    // length=5 (u64 LE) + "hello"
    const len = new Uint8Array([0x05, 0, 0, 0, 0, 0, 0, 0]);
    const str = new TextEncoder().encode("hello");
    const combined = new Uint8Array([...len, ...str]);
    const source = new BrowserFileDataSource(new Blob([combined]) as File);
    expect(await readString(source)).toBe("hello");
  });
});
