import assert from "node:assert/strict";

import {
  ChatRequestError,
  postChatJson,
} from "../lib/ai/chatRequest.ts";

// Mock responses only. No real HTTP requests.
const input = {
  preferences: { size: "10", max_price: 75 },
};

function run(fetchImpl, changes = {}) {
  return postChatJson("/api/stylist-search", input, {
    signal: new AbortController().signal,
    timeoutMs: 1000,
    fetchImpl,
    ...changes,
  });
}

const hasKind = (kind) => (error) =>
  error instanceof ChatRequestError &&
  error.kind === kind;

let passed = 0;

async function check(name, test) {
  await test();
  passed++;
  console.log(`PASS: ${name}`);
}

await check(
  "A successful request keeps the submitted preferences",
  async () => {
    const before = JSON.stringify(input);

    const result = await run(async (url, options) => {
      assert.equal(url, "/api/stylist-search");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), input);

      return Response.json({
        status: "matches",
        products: [{ product_id: "TEST" }],
      });
    });

    assert.equal(result.status, "matches");
    assert.equal(JSON.stringify(input), before);
  }
);

await check(
  "No-match and clarification responses are normal results",
  async () => {
    for (const status of ["no_match", "needs_more_detail"]) {
      const result = await run(async () =>
        Response.json({ status, products: [] })
      );

      assert.equal(result.status, status);
      assert.deepEqual(result.products, []);
    }
  }
);

await check(
  "HTTP failures are not converted into no-match results",
  async () => {
    for (const status of [400, 429, 500, 503]) {
      await assert.rejects(
        run(async () =>
          new Response("Private server detail", { status })
        ),
        (error) =>
          hasKind("http")(error) &&
          error.status === status &&
          !error.message.includes("Private")
      );
    }
  }
);

await check(
  "Malformed success JSON becomes a controlled error",
  async () => {
    await assert.rejects(
      run(async () => new Response("<html>error</html>")),
      hasKind("invalid_json")
    );
  }
);

await check(
  "Network errors do not leak their original message",
  async () => {
    await assert.rejects(
      run(async () => {
        throw new Error("Sensitive connection detail");
      }),
      (error) =>
        hasKind("network")(error) &&
        !error.message.includes("Sensitive")
    );
  }
);

await check(
  "A cancelled request is not sent",
  async () => {
    const controller = new AbortController();
    controller.abort();

    let calls = 0;

    await assert.rejects(
      run(
        async () => {
          calls++;
          return Response.json({});
        },
        { signal: controller.signal }
      ),
      hasKind("cancelled")
    );

    assert.equal(calls, 0);
  }
);

function waitsForAbort(_url, options) {
  return new Promise((_resolve, reject) => {
    options.signal.addEventListener(
      "abort",
      () => {
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

await check(
  "A stalled request times out",
  async () => {
    await assert.rejects(
      run(waitsForAbort, { timeoutMs: 10 }),
      hasKind("timeout")
    );
  }
);

await check(
  "Reset-style cancellation stops an active request",
  async () => {
    const controller = new AbortController();

    const pending = run(waitsForAbort, {
      signal: controller.signal,
    });

    controller.abort();

    await assert.rejects(
      pending,
      hasKind("cancelled")
    );
  }
);

await check(
  "Failures do not start automatic retries",
  async () => {
    let calls = 0;

    await assert.rejects(
      run(async () => {
        calls++;
        return new Response(null, { status: 503 });
      }),
      hasKind("http")
    );

    assert.equal(calls, 1);
  }
);

console.log(`\n${passed} chat-request checks passed.`);