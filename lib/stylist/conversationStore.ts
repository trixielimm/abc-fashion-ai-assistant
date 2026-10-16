// Process-local retry protection for the local prototype. Not a production session store.
export class RetryExpiredError extends Error {}
export class RequestConflictError extends Error {}

type Entry = {
  input: string;
  expires: number;
  plan?: unknown;
  result?: unknown;
  work?: Promise<unknown>;
};

export class ConversationStore {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 10 * 60_000,
    private readonly capacity = 100
  ) {}

  async run(
    id: string,
    input: unknown,
    retry: boolean,
    interpret: () => Promise<unknown>,
    execute: (plan: unknown) => Promise<unknown>
  ): Promise<unknown> {
    for (const [key, value] of this.entries) {
      if (!value.work && value.expires <= this.now()) this.entries.delete(key);
    }

    const fingerprint = JSON.stringify(input);
    let entry = this.entries.get(id);

    if (entry && entry.input !== fingerprint) {
      throw new RequestConflictError("Request ID was reused with different content.");
    }
    if (!entry && retry) {
      throw new RetryExpiredError("Retry expired. Send the message as a new request.");
    }
    if (!entry) {
      if (this.entries.size >= this.capacity) {
        const oldest = [...this.entries].find(([, value]) => !value.work);
        if (!oldest) throw new Error("All request slots are busy.");
        this.entries.delete(oldest[0]);
      }
      entry = { input: fingerprint, expires: this.now() + this.ttlMs };
      this.entries.set(id, entry);
    }

    if (entry.result !== undefined) return entry.result;
    if (entry.work) return entry.work;

    const selected = entry;
    const work = (async () => {
      if (selected.plan === undefined) selected.plan = await interpret();
      const result = await execute(selected.plan);
      selected.result = result;
      return result;
    })();

    selected.work = work;
    try {
      return await work;
    } finally {
      if (selected.work === work) selected.work = undefined;
    }
  }
}