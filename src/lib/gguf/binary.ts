import { DataSource } from "./data-source";

export function readUIntLE(
  buf: Uint8Array,
  offset: number,
  byteLength: number
): bigint {
  let val = 0n;
  for (let i = 0; i < byteLength; i++) {
    val |= BigInt(buf[offset + i]) << BigInt(8 * i);
  }
  return val;
}

export async function readExact(
  source: DataSource,
  size: number
): Promise<Uint8Array> {
  const buf = new Uint8Array(size);
  const ok = await source.read(buf, size);
  if (!ok) throw new Error("Failed to read required bytes");
  return buf;
}

export async function readU32(source: DataSource): Promise<number> {
  const b = await readExact(source, 4);
  return Number(readUIntLE(b, 0, 4));
}

export async function readU64(source: DataSource): Promise<number> {
  const b = await readExact(source, 8);
  return Number(readUIntLE(b, 0, 8));
}

export async function readString(source: DataSource): Promise<string> {
  const len = await readU64(source);
  if (len > 1024 * 1024) throw new Error(`String too long: ${len}`);
  const data = len > 0 ? await readExact(source, len) : new Uint8Array();
  return new TextDecoder().decode(data);
}
