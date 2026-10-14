import assert from "node:assert/strict";

import {
  generateValidatedConversationPlan,
  PlanEvidenceError,
} from "../lib/stylist/conversationPlan.ts";

// Simulated model responses only. No OpenAI or database calls.
const input = {
  message: "Show me lavender clothing under $100.",
};

const valid = {
  action: "new_search",
  intent_evidence: "Show me",
  reference: null,
  question: null,
  changes: [
    {
      scope: "item",
      field: "category",
      operation: "set",
      value: "Clothing",
      evidence: "clothing",
    },
    {
      scope: "item",
      field: "preferred_colours",
      operation: "set",
      value: ["Lavender"],
      evidence: "lavender",
    },
    {
      scope: "item",
      field: "max_price",
      operation: "set",
      value: 100,
      evidence: "under $100",
    },
  ],
};

const badIntent = {
  ...valid,
  intent_evidence: "Find purple garments",
};

const badBudgetEvidence = {
  ...valid,
  changes: valid.changes.map((change) =>
    change.field === "max_price"
      ? {
          ...change,
          evidence: "a budget of 100 Australian dollars",
        }
      : change
  ),
};

let passed = 0;

async function check(name, test) {
  await test();
  passed++;
  console.log(`PASS: ${name}`);
}

await check("Valid evidence needs only one generation", async () => {
  let calls = 0;

  const result = await generateValidatedConversationPlan(
    input,
    async (failedField) => {
      calls++;
      assert.equal(failedField, null);
      return valid;
    }
  );

  assert.equal(calls, 1);
  assert.deepEqual(result, valid);
});

await check("Invalid intent evidence permits one correction", async () => {
  const feedback = [];

  const result = await generateValidatedConversationPlan(
    input,
    async (failedField) => {
      feedback.push(failedField);
      return feedback.length === 1 ? badIntent : valid;
    }
  );

  assert.deepEqual(feedback, [null, "intent_evidence"]);
  assert.deepEqual(result, valid);
});

await check("Invalid change evidence identifies the failing field", async () => {
  const feedback = [];

  const result = await generateValidatedConversationPlan(
    input,
    async (failedField) => {
      feedback.push(failedField);

      return feedback.length === 1
        ? badBudgetEvidence
        : valid;
    }
  );

  assert.deepEqual(feedback, [
    null,
    "changes.item.max_price.evidence",
  ]);

  assert.equal(result.changes[2].value, 100);
});

await check("Two invalid responses fail instead of bypassing validation", async () => {
  let calls = 0;

  await assert.rejects(
    generateValidatedConversationPlan(input, async () => {
      calls++;
      return badIntent;
    }),
    PlanEvidenceError
  );

  assert.equal(calls, 2);
});

await check("Other plan safeguards are not weakened or retried", async () => {
  let calls = 0;

  const invalidScope = {
    ...valid,
    changes: [
      {
        scope: "shared",
        field: "category",
        operation: "set",
        value: "Clothing",
        evidence: "clothing",
      },
    ],
  };

  await assert.rejects(
    generateValidatedConversationPlan(input, async () => {
      calls++;
      return invalidScope;
    }),
    /Product identity and size cannot be shared globally/
  );

  assert.equal(calls, 1);
});

await check("Provider failures are not retried by the evidence helper", async () => {
  let calls = 0;
  const failure = new Error("Simulated provider failure");

  await assert.rejects(
    generateValidatedConversationPlan(input, async () => {
      calls++;
      throw failure;
    }),
    (error) => error === failure
  );

  assert.equal(calls, 1);
});

console.log(`\n${passed} plan-evidence checks passed.`);