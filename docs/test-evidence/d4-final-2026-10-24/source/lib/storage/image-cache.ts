type Entry = { buffer: Buffer; expiresAt: number };

// Process-local byte cache. Callers must authorise access before using it.
export class ImageCache {
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Promise<Buffer>>();
  private bytes = 0;

  constructor(
    private readonly maxBytes: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string, load: () => Promise<Buffer>): Promise<Buffer> {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.bytes -= entry.buffer.length;
      if (entry.expiresAt > this.now()) {
        this.entries.set(key, entry);
        this.bytes += entry.buffer.length;
        return entry.buffer;
      }
    }

    const pending = this.pending.get(key);
    if (pending) return pending;

    const request = Promise.resolve().then(load).then(buffer => {
      if (buffer.length <= this.maxBytes) {
        for (const [oldKey, oldEntry] of this.entries) {
          if (oldEntry.expiresAt <= this.now() || this.bytes + buffer.length > this.maxBytes) {
            this.entries.delete(oldKey);
            this.bytes -= oldEntry.buffer.length;
          }
        }
        this.entries.set(key, { buffer, expiresAt: this.now() + this.ttlMs });
        this.bytes += buffer.length;
      }
      return buffer;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
}
