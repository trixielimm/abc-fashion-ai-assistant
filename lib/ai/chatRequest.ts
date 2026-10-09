type FailureKind =
  | "network"
  | "http"
  | "invalid_json"
  | "timeout"
  | "cancelled";

export class ChatRequestError extends Error {
  readonly kind: FailureKind;
  readonly status?: number;

  constructor(kind: FailureKind, status?: number) {
    super(`Chat request failed: ${kind}`);
    this.name = "ChatRequestError";
    this.kind = kind;
    this.status = status;
  }
}

export async function postChatJson(
  endpoint: "/api/extraction" | "/api/stylist-search",
  body: unknown,
  options: {
    signal: AbortSignal;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<unknown> {
  const {
    signal,
    timeoutMs = 90_000,
    fetchImpl = fetch,
  } = options;

  if (signal.aborted) {
    throw new ChatRequestError("cancelled");
  }

  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();

  signal.addEventListener("abort", cancel, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ChatRequestError("http", response.status);
    }

    const data: unknown = await response.json();

    if (controller.signal.aborted) {
      throw new ChatRequestError(
        timedOut ? "timeout" : "cancelled"
      );
    }

    return data;
  } catch (error) {
    if (signal.aborted) {
      throw new ChatRequestError("cancelled");
    }

    if (timedOut) {
      throw new ChatRequestError("timeout");
    }

    if (error instanceof ChatRequestError) throw error;

    if (error instanceof SyntaxError) {
      throw new ChatRequestError("invalid_json");
    }

    // Do not expose raw network/provider details to the chat.
    throw new ChatRequestError("network");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}