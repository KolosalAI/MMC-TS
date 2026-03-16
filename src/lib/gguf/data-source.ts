export abstract class DataSource {
  abstract read(buffer: Uint8Array, size: number): Promise<boolean>;
  abstract seek(position: number): Promise<boolean>;
  abstract eof(): boolean;
  abstract tell(): number;
  setAbortFlag?(): void;
}

export class BrowserFileDataSource extends DataSource {
  private file: File | Blob;
  private position: number = 0;
  private _eof: boolean = false;

  constructor(file: File | Blob) {
    super();
    this.file = file;
  }

  async read(buffer: Uint8Array, size: number): Promise<boolean> {
    const end = Math.min(this.position + size, this.file.size);
    const slice = this.file.slice(this.position, end);
    const arr = new Uint8Array(await slice.arrayBuffer());
    if (arr.length === 0) {
      this._eof = true;
      return false;
    }
    buffer.set(arr.subarray(0, size), 0);
    this.position += arr.length;
    return arr.length === size;
  }

  async seek(position: number): Promise<boolean> {
    this.position = position;
    this._eof = false;
    return true;
  }

  eof(): boolean {
    return this._eof;
  }

  tell(): number {
    return this.position;
  }
}
