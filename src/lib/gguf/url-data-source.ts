import { DataSource } from "./data-source";

const BUFFER_SIZE = 1 << 20; // 1 MiB
const CHUNK_SIZE = 1 << 18; // 256 KiB per range

export class UrlDataSource extends DataSource {
  private url: string;
  private verbose: boolean;
  private currentPos: number = 0;
  private _eof: boolean = false;
  private abortDownload: boolean = false;
  private downloadedData: Uint8Array;
  private bufferSize: number = 0;
  private bufferPos: number = 0;
  private logFn?: (...args: string[]) => void;

  constructor(
    url: string,
    options: { verbose?: boolean; logFn?: (...args: string[]) => void } = {}
  ) {
    super();
    this.url = url;
    this.verbose = options.verbose ?? false;
    this.logFn = options.logFn;
    this.downloadedData = new Uint8Array(BUFFER_SIZE);
  }

  private log(...args: string[]) {
    if (this.logFn) this.logFn(...args);
  }

  private async fetchRange(
    start: number,
    endExclusive: number
  ): Promise<Uint8Array> {
    if (this.abortDownload) return new Uint8Array(0);
    const endInclusive = endExclusive - 1;
    if (this.verbose)
      this.log(`[HTTP] GET Range: bytes=${start}-${endInclusive}`);
    const res = await fetch(this.url, {
      headers: { Range: `bytes=${start}-${endInclusive}` },
    });
    if (!res.ok && res.status !== 206 && res.status !== 200) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const arr = new Uint8Array(await res.arrayBuffer());
    if (res.status === 200 && start > 0) {
      if (this.verbose)
        this.log(
          "[HTTP] Warning: server ignored Range; received full body with 200."
        );
      if (arr.length <= start) return new Uint8Array(0);
      return arr.subarray(start, Math.min(arr.length, endExclusive));
    }
    return arr;
  }

  async read(buffer: Uint8Array, size: number): Promise<boolean> {
    while (this.bufferPos + size > this.bufferSize) {
      if (this.bufferPos >= this.bufferSize) {
        this.bufferSize = 0;
        this.bufferPos = 0;
      }
      if (this.bufferPos > 0 && this.bufferSize > this.bufferPos) {
        this.downloadedData.copyWithin(0, this.bufferPos, this.bufferSize);
        this.bufferSize -= this.bufferPos;
        this.bufferPos = 0;
      }
      const wantStart = this.currentPos + this.bufferSize;
      const chunkEnd = wantStart + CHUNK_SIZE;
      const neededCapacity = this.bufferSize + CHUNK_SIZE;
      if (neededCapacity > this.downloadedData.length) {
        const newBuf = new Uint8Array(
          Math.max(this.downloadedData.length * 2, neededCapacity)
        );
        newBuf.set(this.downloadedData.subarray(0, this.bufferSize), 0);
        this.downloadedData = newBuf;
      }
      if (this.abortDownload) {
        this._eof = true;
        return false;
      }
      const arr = await this.fetchRange(wantStart, chunkEnd);
      if (arr.length === 0) {
        this._eof = true;
        return false;
      }
      this.downloadedData.set(arr, this.bufferSize);
      this.bufferSize += arr.length;
    }
    const copySize = Math.min(size, this.bufferSize - this.bufferPos);
    buffer.set(
      this.downloadedData.subarray(this.bufferPos, this.bufferPos + copySize),
      0
    );
    this.bufferPos += copySize;
    this.currentPos += copySize;
    return copySize === size;
  }

  async seek(position: number): Promise<boolean> {
    if (
      position >= this.currentPos - this.bufferPos &&
      position < this.currentPos + (this.bufferSize - this.bufferPos)
    ) {
      this.bufferPos = position - (this.currentPos - this.bufferPos);
      this.currentPos = position;
      return true;
    }
    this.bufferSize = 0;
    this.bufferPos = 0;
    this.currentPos = position;
    this._eof = false;
    return true;
  }

  eof(): boolean {
    return this._eof;
  }

  tell(): number {
    return this.currentPos;
  }

  setAbortFlag(): void {
    this.abortDownload = true;
  }
}
