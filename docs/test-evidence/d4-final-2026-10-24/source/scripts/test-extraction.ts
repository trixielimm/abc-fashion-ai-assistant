import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { extractPreferences } from "../lib/ai/extractPreferences";
import { ShoppingPreferencesSchema, type ShoppingPreferences } from "../lib/ai/preferenceSchema";

// Run with: node --conditions=react-server --import tsx scripts/test-extraction.ts
if (existsSync(".env.local")) loadEnvFile(".env.local");

const cases: { message: string; expected: Partial<ShoppingPreferences> }[] = [
  {
    message: "I need a black dress under $150 for a wedding in size 10.",
    expected: { gender: null, category: "Clothing", subcategory: "Dresses", occasion: "Wedding Guest", preferred_colours: ["Black"], size: "10", max_price: 150 },
  },
  {
    message: "I’m going to a beach wedding and want something elegant, maybe sage or blue.",
    expected: { gender: null, category: null, subcategory: null, product_type: null, style: "Elegant", preferred_colours: ["Sage", "Blue"], season: null, size: null, max_price: null },
  },
  {
    message: "I need something casual for brunch under $100.",
    expected: { category: null, style: "Casual", occasion: "Brunch", max_price: 100 },
  },
  {
    message: "Show me men’s shoes for work in size 11.",
    expected: { gender: "Men", category: "Shoes", subcategory: null, size: "11" },
  },
  {
    message: "I want a romantic outfit for date night but nothing red.",
    expected: { gender: null, style: "Romantic", occasion: "Date Night", preferred_colours: [], excluded_colours: ["Red"] },
  },
  {
    message: "A bag costing at least $100 and up to $150.",
    expected: { category: "Bags", min_price: 100, max_price: 150 },
  },
];

async function main() {
  await assert.rejects(extractPreferences("   "), /cannot be empty/);
  console.log("PASS: blank input rejected");

  if (!process.env.OPENAI_API_KEY) {
    await assert.rejects(extractPreferences(cases[0].message), /not configured/);
    console.log("PASS: missing API key handled");
    console.log("BLOCKED: configure OPENAI_API_KEY in .env.local to run live cases.");
    process.exitCode = 1;
    return;
  }

  for (const { message, expected } of cases) {
    const preferences = ShoppingPreferencesSchema.parse(await extractPreferences(message));
    console.log(JSON.stringify({ message, preferences }, null, 2));
    for (const key of Object.keys(expected) as (keyof ShoppingPreferences)[]) {
      assert.deepEqual(preferences[key], expected[key], `Unexpected ${key}: ${message}`);
    }
  }
  console.log(`PASS: ${cases.length} live extraction cases`);
}

main().catch(() => {
  // Provider errors can contain request details; do not print them or credentials.
  console.error("FAIL: extraction or preference assertion failed. Check configuration and the results above.");
  process.exitCode = 1;
});
