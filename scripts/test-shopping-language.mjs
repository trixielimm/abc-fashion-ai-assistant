import assert from "node:assert/strict";
import { shoppingSpellingView, canonicalShoppingValue } from "../lib/catalogue/shoppingLanguage.ts";
import { ShoppingPreferencesSchema } from "../lib/ai/preferenceSchema.ts";
import { validatePreferences } from "../lib/ai/validatePreferences.ts";
import { checkConversationPlan } from "../lib/stylist/conversationPlan.ts";
import { groundConversationPlan } from "../lib/stylist/conversationGrounding.ts";
import { makeTurn, acceptReply } from "../lib/stylist/conversationProtocol.ts";
import { finishConversationTurn, shortcutPlan, interpreterInput } from "../lib/stylist/conversationTurn.ts";
import { allCollectionSession } from "./fixtures/collection-session.mjs";

const dress = { product_id: "D1", product_name: "Lavender Wrap Dress", category: "Clothing", subcategory: "Dresses", product_type: "Wrap Dress", colour: "Lavender", price_aud: 150, stock_qty: 8, is_available: true, sizes_available: ["10", "12"], material: "Cotton", occasion: "Wedding Guest", style: "Formal", fit: "Regular", season: "Summer", gender: "Women", brand_line: null, tags: [], description: null, image_key: null, cross_sell_category: null };
const shirt = { ...dress, product_id: "T1", product_name: "White Cotton Shirt", subcategory: "Tops", product_type: "Cotton Shirt", colour: "White", price_aud: 80 };
const blue = { ...dress, product_id: "D2", product_name: "Blue Wrap Dress", colour: "Blue", price_aud: 70 };
const blouse = { ...shirt, product_id: "T2", product_name: "White Blouse", product_type: "Blouse" };
const shoes = { ...dress, product_id: "S1", product_name: "White Low-Top Sneakers", category: "Shoes", subcategory: "Sneakers", product_type: "Low-Top Sneakers", colour: "White", sizes_available: ["7"], price_aud: 80 };
const skirt = { ...dress, product_id: "K1", product_name: "Black Pleated Skirt", subcategory: "Bottoms", product_type: "Pleated Skirt", colour: "Black", price_aud: 70 };
const rows = [dress, shirt, blue, blouse, shoes, skirt];
const vocabulary = { rows: [...rows, { ...skirt, colour: "Burgundy" }], sizes: ["7", "10", "12", "M"], categories: [...new Map(rows.map(row => [row.category + row.subcategory, { category: row.category, subcategory: row.subcategory }])).values()] };
const change = (field, value, evidence, operation = "set", scope = "item") => ({ field, value, evidence, operation, scope });
const plan = (message, changes = [], action = "new_search") => ({ action, intent_evidence: message, changes, reference: null, question: null, continuation: false });
const finish = (state, message, changes = [], catalogue = rows, action = "new_search") => {
  const turn = makeTurn(state, message);
  const reply = finishConversationTurn(catalogue, turn, plan(message, changes, action), vocabulary);
  return { turn, reply, state: acceptReply(turn, reply).session };
};
let passed = 0;
function check(name, run) { run(); passed++; console.log(`PASS: ${name}`); }

for (const [typo, expected] of Object.entries({ lavendar: "lavender", burgandy: "burgundy", dres: "dress", skrit: "skirt", shrit: "shirt", jaket: "jacket", blous: "blouse", sneekers: "sneakers", sandles: "sandals", handbg: "handbag", neckalce: "necklace", cotten: "cotton", polyster: "polyester", weddding: "wedding", meduim: "medium" })) {
  check(`Recognises ${typo} without changing original quotation evidence`, () => {
    const view = shoppingSpellingView(`Show me ${typo}, please.`);
    assert.equal(view.text, `Show me ${expected}, please.`);
    assert.equal(view.originalQuote(expected), typo);
  });
}
check("Legitimate terms, identifiers, budgets and unknown words are not fuzzy matched", () => {
  const text = "Lilac purple red sage regular BrandX P1004 XS 12 $100 ultraviolet waterproof";
  assert.equal(shoppingSpellingView(text).text, text);
  assert.equal(canonicalShoppingValue("preferred_colours", "cotten"), "cotten");
  assert.equal(shoppingSpellingView("Lavendar Dress", ["Lavendar Dress"]).text, "Lavendar Dress");
});
check("Preference validation corrects known spelling for colours, material and size only", () => {
  const empty = allCollectionSession().scopes.item;
  const input = ShoppingPreferencesSchema.parse({ ...empty, preferred_colours: ["lavendar", "LAVENDER"], material: "cotten", size: "meduim" });
  const result = validatePreferences(input, vocabulary);
  assert.equal(result.needs_clarification, false);
  assert.deepEqual(result.preferences.preferred_colours, ["Lavender"]);
  assert.equal(result.preferences.material, "Cotton");
  assert.equal(result.preferences.size, "M");
  assert.equal(input.size, "meduim");
  assert.equal(validatePreferences({ ...empty, preferred_colours: ["Lilac"] }, vocabulary).needs_clarification, true);
});
for (const message of ["i want a lavendar dress", "I want a lavendar dres", "I WANT A LAVENDAR DRES"]) {
  check(`A complete request returns dresses: ${message}`, () => {
    const { reply, state } = finish(allCollectionSession(), message);
    assert.equal(reply.status, "matches");
    assert.deepEqual(reply.products.map(product => product.product_id), ["D1"]);
    assert.deepEqual(state.scopes.item.preferred_colours, ["Lavender"]);
    assert.equal(reply.pending, null);
    assert.equal(state.history.at(-2).content, message);
    const grounded = groundConversationPlan(interpreterInput(makeTurn(allCollectionSession(), message)), plan(message));
    for (const entry of grounded.changes) assert.ok(message.toLowerCase().includes(entry.evidence.toLowerCase()), entry.evidence);
  });
}
check("Invented corrected quotation evidence still fails validation", () => {
  assert.throws(() => checkConversationPlan({ message: "I want a lavendar dres" }, plan("I want a lavendar dres", [change("preferred_colours", ["Lavender"], "lavender")])), /evidence/i);
});
check("Raw typo values in a model plan normalize before generic dress handling", () => {
  const { reply } = finish(allCollectionSession(), "I want a lavendar dres", [change("product_type", "Dres", "dres"), change("preferred_colours", ["Lavendar"], "lavendar")]);
  assert.equal(reply.status, "matches");
  assert.equal(reply.applied_preferences.product_type, null);
  assert.deepEqual(reply.applied_preferences.preferred_colours, ["Lavender"]);
});
for (const [message, expected] of [["Show me a white blous", "T2"], ["Show me a black skrit", "K1"], ["Show me a white cotten shrit", "T1"]]) {
  check(`Grounds common garment and material typos: ${message}`, () => {
    const { reply } = finish(allCollectionSession(), message);
    assert.equal(reply.status, "matches");
    assert.ok(reply.products.some(product => product.product_id === expected));
  });
}
check("Generic sneakers match recorded Low-Top Sneakers", () => {
  const { reply } = finish(allCollectionSession(), "Show me white sneekers", [change("category", "Shoes", "sneekers"), change("product_type", "Sneakers", "sneekers"), change("preferred_colours", ["White"], "white")]);
  assert.equal(reply.status, "matches");
  assert.deepEqual(reply.products.map(product => product.product_id), ["S1"]);
});
check("A misspelled shoe request survives an empty model change list", () => {
  const { reply } = finish(allCollectionSession(), "Show me white sneekers");
  assert.equal(reply.status, "matches");
  assert.deepEqual(reply.products.map(product => product.product_id), ["S1"]);
});
check("A misspelled catalogue colour is grounded even when the model omits it", () => {
  const { reply } = finish(allCollectionSession(), "Show me a burgandy skrit", [], [{ ...skirt, colour: "Burgundy", product_name: "Burgundy Pleated Skirt" }]);
  assert.equal(reply.status, "matches");
  assert.deepEqual(reply.applied_preferences.preferred_colours, ["Burgundy"]);
  assert.ok(reply.products.every(product => product.colour === "Burgundy"));
});
check("Switching shirts to dresses clears the stale shirt type and retains saved limits", () => {
  const state = allCollectionSession();
  Object.assign(state.scopes.item, { category: "Clothing", subcategory: "Tops", product_type: "Shirt", size: "10", max_price: 200, excluded_colours: ["Blue"] });
  state.history = [{ role: "assistant", content: "What occasion are you shopping for? You can also keep browsing these options." }];
  const { reply } = finish(state, "i want a lavendar dress");
  assert.equal(reply.status, "matches");
  assert.equal(reply.applied_preferences.product_type, null);
  assert.equal(reply.applied_preferences.subcategory, "Dresses");
  assert.equal(reply.applied_preferences.size, "10");
  assert.equal(reply.applied_preferences.max_price, 200);
  assert.deepEqual(reply.applied_preferences.excluded_colours, ["Blue"]);
  assert.equal(reply.optional_question, null);
});
check("Same-family colour refinements retain a previously requested dress type", () => {
  const state = allCollectionSession();
  Object.assign(state.scopes.item, { category: "Clothing", subcategory: "Dresses", product_type: "Wrap Dress", max_price: 200 });
  const { reply } = finish(state, "I want a lavendar dress");
  assert.equal(reply.applied_preferences.product_type, "Wrap Dress");
  assert.equal(reply.applied_preferences.max_price, 200);
});
check("An incompatible shirt type saved by the older app is repaired on a repeated dress request", () => {
  const state = allCollectionSession();
  Object.assign(state.scopes.item, { category: "Clothing", subcategory: "Dresses", product_type: "Shirt", max_price: 200 });
  const { reply } = finish(state, "I want a lavender dress");
  assert.equal(reply.status, "matches");
  assert.equal(reply.applied_preferences.product_type, null);
  assert.equal(reply.applied_preferences.max_price, 200);
});
check("A misspelled colour exclusion is retained and never becomes a preference", () => {
  const { reply } = finish(allCollectionSession(), "I want a dress, no lavendar", [change("excluded_colours", ["Lavendar"], "no lavendar", "add")]);
  assert.deepEqual(reply.applied_preferences.preferred_colours, []);
  assert.deepEqual(reply.applied_preferences.excluded_colours, ["Lavender"]);
  assert.ok(reply.products.every(product => product.colour !== "Lavender"));
});
check("Unsupported physical requirements survive spelling correction", () => {
  const { reply } = finish(allCollectionSession(), "I want a waterproof lavendar dres", [change("unresolved", ["waterproof"], "waterproof", "add")]);
  assert.equal(reply.status, "needs_clarification");
  assert.ok(reply.proposed_scopes.unresolved_item.includes("waterproof"));
  assert.deepEqual(reply.products, []);
});
check("A misspelled material exclusion cannot be silently omitted", () => {
  const message = "I want a lavendar dress, no polyster";
  assert.throws(() => checkConversationPlan({ message }, plan(message)), /polyester exclusion/);
  const { reply } = finish(allCollectionSession(), message, [change("unresolved", ["no polyster"], "no polyster", "add")]);
  assert.equal(reply.status, "needs_clarification");
  assert.ok(reply.proposed_scopes.unresolved_item.includes("no polyster"));
});
check("A real budget blocker states the verified minimum without raising the cap", () => {
  const { reply } = finish(allCollectionSession(), "I want a lavendar dress under $100");
  assert.equal(reply.status, "no_match");
  assert.match(reply.message, /A\$100\.00.*A\$150\.00/);
  assert.equal(reply.applied_preferences.max_price, 100);
  assert.deepEqual(reply.products, []);
  assert.equal(reply.can_preview_other_colours, true);
});
check("Correcting a repeated spelling acknowledges the request and explains the saved cap", () => {
  const first = finish(allCollectionSession(), "I want a lavendar dress under $100");
  const second = finish(first.state, "I want a lavendar dress", [], rows, "refine");
  const corrected = finish(second.state, "I want a lavender dress", [], rows, "refine");
  assert.match(corrected.reply.message, /^I understood your request for lavender dresses\./);
  assert.match(corrected.reply.message, /A\$100\.00.*A\$150\.00/);
  assert.equal(corrected.reply.applied_preferences.max_price, 100);
});
check("Size blockers are explained without changing the requested size", () => {
  const state = allCollectionSession();
  Object.assign(state.scopes.item, { category: "Clothing", subcategory: "Dresses", preferred_colours: ["Lavender"], size: "7" });
  const { reply } = finish(state, "I want a lavender dress");
  assert.equal(reply.status, "no_match");
  assert.match(reply.message, /none list your requested size, 7/);
  assert.equal(reply.applied_preferences.size, "7");
  assert.equal(reply.can_preview_other_colours, false);
});
check("No colour-preview button appears when every alternative is ineligible", () => {
  const state = allCollectionSession();
  state.cart_product_ids = ["D2"];
  const first = finish(state, "I want a lavender dress under $100");
  assert.equal(first.reply.can_preview_other_colours, false);
  const turn = makeTurn(first.state, "Preview other colours", null, undefined, true);
  const preview = finishConversationTurn(rows, turn, shortcutPlan(turn), vocabulary);
  assert.deepEqual(preview.alternatives, []);
});
check("A colour preview respects rejected products and keeps the original preferences", () => {
  const first = finish(allCollectionSession(), "I want a lavender dress under $100");
  const turn = makeTurn(first.state, "Preview other colours", null, undefined, true);
  const preview = finishConversationTurn(rows, turn, shortcutPlan(turn), vocabulary);
  assert.deepEqual(preview.alternatives.map(product => product.product_id), ["D2"]);
  assert.equal(preview.applied_preferences.max_price, 100);
  assert.deepEqual(preview.proposed_scopes.item.preferred_colours, ["Lavender"]);
});
check("Unavailable products do not generate a claimed minimum or a colour preview", () => {
  const { reply } = finish(allCollectionSession(), "I want a lavender dress under $100", [], rows.map(product => ({ ...product, stock_qty: 0, is_available: false })));
  assert.equal(reply.status, "no_match");
  assert.equal(reply.can_preview_other_colours, false);
  assert.doesNotMatch(reply.message, /lowest-priced|A\$150/);
});
console.log(`\n${passed} shopping-language checks passed.`);
