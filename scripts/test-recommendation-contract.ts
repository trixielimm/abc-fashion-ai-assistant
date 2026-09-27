import assert from "node:assert/strict";

import { RecommendationRequestSchema } from "../lib/recommendations/apiContract";

const cases: Array<{
  name: string;
  input: unknown;
  shouldPass: boolean;
}> = [
  {
    name: "Valid request accepted",
    input: { message: "Show me lavender clothing.", limit: 6 },
    shouldPass: true,
  },
  {
    name: "Empty message rejected",
    input: { message: "" },
    shouldPass: false,
  },
  {
    name: "Spaces-only message rejected",
    input: { message: "   " },
    shouldPass: false,
  },
  {
    name: "Missing message rejected",
    input: { limit: 6 },
    shouldPass: false,
  },
  {
    name: "Limit above six rejected",
    input: { message: "Show me clothing.", limit: 7 },
    shouldPass: false,
  },
  {
    name: "Fractional limit rejected",
    input: { message: "Show me clothing.", limit: 2.5 },
    shouldPass: false,
  },
  {
    name: "Unsupported history field rejected",
    input: { message: "Show me clothing.", history: [] },
    shouldPass: false,
  },
  {
    name: "Overlong message rejected",
    input: { message: "a".repeat(2001) },
    shouldPass: false,
  },
];

for (const testCase of cases) {
  const result = RecommendationRequestSchema.safeParse(testCase.input);

  assert.equal(
    result.success,
    testCase.shouldPass,
    `FAILED: ${testCase.name}`
  );

  console.log(`PASS: ${testCase.name}`);
}

// Check that an omitted limit defaults to six.
const defaultResult = RecommendationRequestSchema.parse({
  message: "Show me clothing.",
});

assert.equal(defaultResult.limit, 6);
console.log("PASS: Default limit is six");

// Check that surrounding spaces are removed.
const trimmedResult = RecommendationRequestSchema.parse({
  message: "  Show me clothing.  ",
});

assert.equal(trimmedResult.message, "Show me clothing.");
console.log("PASS: Message is trimmed");

console.log(`\n${cases.length + 2} request-contract checks passed.`);