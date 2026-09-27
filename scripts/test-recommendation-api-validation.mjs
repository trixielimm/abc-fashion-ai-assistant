import assert from "node:assert/strict";

const endpoint = "http://127.0.0.1:3000/api/recommendations";

const tests = [
  {
    name: "Blank message rejected",
    contentType: "application/json",
    body: JSON.stringify({
      message: "   ",
      limit: 6,
    }),
    expectedStatus: 400,
  },
  {
    name: "Missing message rejected",
    contentType: "application/json",
    body: JSON.stringify({
      limit: 6,
    }),
    expectedStatus: 400,
  },
  {
    name: "Limit above six rejected",
    contentType: "application/json",
    body: JSON.stringify({
      message: "Show me clothing.",
      limit: 7,
    }),
    expectedStatus: 400,
  },
  {
    name: "Unsupported history rejected",
    contentType: "application/json",
    body: JSON.stringify({
      message: "Show me clothing.",
      history: [],
    }),
    expectedStatus: 400,
  },
  {
    name: "Malformed JSON rejected",
    contentType: "application/json",

    // Deliberately incomplete JSON to test error handling.
    body: '{"message":',
    expectedStatus: 400,
  },
  {
    name: "Wrong content type rejected",
    contentType: "text/plain",
    body: JSON.stringify({
      message: "Show me clothing.",
    }),
    expectedStatus: 415,
  },
];

let passed = 0;

for (const test of tests) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": test.contentType,
      },
      body: test.body,
      signal: AbortSignal.timeout(30_000),
    });

    // Read the complete response before checking it.
    const text = await response.text();

    assert.equal(
      response.status,
      test.expectedStatus,
      `Expected HTTP ${test.expectedStatus}, received ${response.status}.`
    );

    const result = JSON.parse(text);

    assert.equal(
      result.success,
      false,
      "The API should report success: false for invalid input."
    );

    assert.equal(
      result.code,
      "INVALID_REQUEST",
      "The API should identify the problem as INVALID_REQUEST."
    );

    assert.equal(
      typeof result.request_id,
      "string",
      "The response should contain a request ID."
    );

    assert.ok(
      result.request_id.trim().length > 0,
      "The request ID should not be empty."
    );

    console.log(
      `PASS: ${test.name} (HTTP ${response.status})`
    );

    passed += 1;
  } catch (error) {
    console.error(`FAIL: ${test.name}`);
    console.error(
      error instanceof Error ? error.message : String(error)
    );

    // Stop at the first failed check.
    process.exitCode = 1;
    break;
  }
}

if (passed === tests.length) {
  console.log(`\n${passed} API validation checks passed.`);
}