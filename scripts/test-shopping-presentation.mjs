import assert from "node:assert/strict";
import { catalogueImageSource, safeLocalImagePath, safeProductImageSource } from "../lib/stylist/catalogueImages.ts";
import { makeTurn, acceptReply, TurnReplySchema } from "../lib/stylist/conversationProtocol.ts";
import { allCollectionSession as newSession } from "./fixtures/collection-session.mjs";
import { finishConversationTurn, shortcutPlan } from "../lib/stylist/conversationTurn.ts";

// Synthetic catalogue and model decisions only. No network or database calls.
const dress = {
  product_id: "D1", product_name: "Test Lavender Dress", price_aud: 60,
  category: "Clothing", subcategory: "Dresses", product_type: "Wrap Dress",
  colour: "Lavender", style: "Relaxed", occasion: "Wedding Guest",
  fit: "Regular", season: "Summer", material: "Cotton", gender: null,
  brand_line: "Test Collection", sizes_available: ["10"], stock_qty: 5,
  is_available: true, image_key: null, cross_sell_category: "Bags",
  description: null, tags: [],
};
const formal = { ...dress, product_id: "D2", product_name: "Formal Test Dress", style: "Formal", price_aud: 50 };
const blue = { ...dress, product_id: "D3", product_name: "Blue Test Dress", colour: "Blue", price_aud: 45 };
const brown = { ...dress, product_id: "D4", product_name: "Brown Test Dress", colour: "Brown", price_aud: 40 };
const bag = { ...blue, product_id: "B1", product_name: "Test Bag", category: "Bags", subcategory: "Clutches", product_type: "Clutch", sizes_available: ["One Size"], cross_sell_category: null };
const rows = [dress, formal, blue, brown, bag];
const vocabulary = {
  rows, sizes: ["10", "12", "One Size"], categories: [
    { category: "Clothing", subcategory: null }, { category: "Clothing", subcategory: "Dresses" },
    { category: "Bags", subcategory: null }, { category: "Bags", subcategory: "Clutches" },
  ],
};
function session(changes = {}) {
  const result = newSession();
  Object.assign(result.scopes.item, {
    category: "Clothing", subcategory: "Dresses", preferred_colours: ["Lavender"],
    style: "Relaxed", occasion: "Wedding Guest", ...changes,
  });
  return result;
}
const plan = (turn, action = "refine") => ({
  action, intent_evidence: turn.message, reference: null, changes: [], question: null, continuation: false,
});
function run(catalogue = rows, changes = {}, options = {}) {
  const saved = options.session ?? session(changes);
  const turn = makeTurn(saved, "Show my current request", null, undefined, options.preview ?? false);
  const result = finishConversationTurn(catalogue, turn, options.preview ? shortcutPlan(turn) : plan(turn, options.action), vocabulary);
  return { result, turn };
}
let passed = 0;
function check(name, test) { test(); passed++; console.log(`PASS: ${name}`); }

check("A single exact product uses its real name and price in the message", () => {
  const { result } = run([dress]);
  assert.equal(result.status, "matches");
  assert.ok(
  result.message.startsWith("I found Test Lavender Dress for A$60.00.")
);
assert.ok(result.message.includes("\n\n"));
  assert.equal(result.products.length, 1);
  assert.deepEqual(result.alternatives, []);
});
check("No budget and size stay unknown instead of becoming a questionnaire", () => {
  const { result } = run([dress]);
  assert.equal(result.applied_preferences.size, null);
  assert.equal(result.applied_preferences.max_price, null);
  assert.equal(result.pending, null);
});
check("Exact products and softer context alternatives are separate", () => {
  const { result } = run([dress, formal]);
  assert.equal(result.status, "matches");
  assert.deepEqual(result.products.map(p => p.product_id), ["D1"]);
  assert.deepEqual(result.alternatives.map(p => p.product_id), ["D2"]);
  assert.match(result.alternatives[0].differences[0], /Formal.*Relaxed/);
});
check("Partial-only results are alternatives, not exact matches", () => {
  const { result } = run([formal]);
  assert.equal(result.status, "alternatives");
  assert.deepEqual(result.products, []);
  assert.equal(result.alternative_kind, "context_difference");
});
check("A missing context attribute is labelled unverified, not invented", () => {
  const { result } = run([{ ...dress, style: null }]);
  assert.equal(result.status, "alternatives");
  assert.ok(result.alternatives[0].differences.some(value => value.includes("not recorded")));
});
check("A verified image source is mapped by exact product ID", () => {
  assert.equal(catalogueImageSource(dress, { D1: "/images/catalogue/d1.jpg" }), "/images/catalogue/d1.jpg");
  assert.equal(catalogueImageSource(blue, { D1: "/images/catalogue/d1.jpg" }), null);
});
check("Storage keys use the catalogue-authorised product image route", () => {
  assert.equal(catalogueImageSource({ ...dress, image_key: "abc_1002.jpg" }), "/api/products/D1/image");
  assert.equal(catalogueImageSource({ ...dress, product_id: "ABC/001", image_key: "products/main.jpg" }), "/api/products/ABC%2F001/image");
  assert.equal(catalogueImageSource({ ...dress, image_key: "/images/catalogue/d1.webp" }), "/images/catalogue/d1.webp");
  assert.equal(catalogueImageSource({ ...dress, image_key: "products/main.jpg" }, { D1: "/images/old.jpg" }), "/api/products/D1/image");
});
check("Image responses accept only local photos or stable product image routes", () => {
  for (const path of ["/images/catalogue/d1.webp", "/api/products/D1/image", "/api/products/ABC%2F001/image"]) {
    assert.equal(safeProductImageSource(path), true);
  }
  for (const path of ["https://example.test/a.jpg", "//example.test/a.jpg", "/api/products/../image", "/api/products/%2e%2e/image", "/api/products/D1/image?token=secret", "/api/products/%ZZ/image", "/api/products/D1/image#x"]) {
    assert.equal(safeProductImageSource(path), false);
  }
});
check("A response cannot attach another product's image route", () => {
  const { result } = run([{ ...dress, image_key: "products/main.jpg" }]);
  assert.equal(TurnReplySchema.parse(result).products[0].image_src, "/api/products/D1/image");
  assert.throws(() => TurnReplySchema.parse({ ...result, products: [{ ...result.products[0], image_src: "/api/products/D2/image" }] }));
});
check("External, traversal, query and SVG image paths are rejected", () => {
  for (const path of ["https://example.test/a.jpg", "//example.test/a.jpg", "/images/../secret.jpg", "/images/%2e%2e/a.jpg", "/images/a.svg", "/images/a.jpg?x=1"]) {
    assert.equal(safeLocalImagePath(path), false);
  }
});
check("Only a recognised, unambiguous stored cross-sell target is offered", () => {
  assert.equal(run([dress]).result.products[0].extra_target, "Bags");
  assert.equal(run([{ ...dress, cross_sell_category: "Invented" }]).result.products[0].extra_target, null);
});
check("An optional occasion question appears alongside products without pending state", () => {
  const turn = makeTurn(newSession(), "Show Clothing");
  const categoryPlan = { ...plan(turn, "new_search"), changes: [{scope:"item",field:"category",operation:"set",value:"Clothing",evidence:"Clothing"}] };
  const reply = finishConversationTurn([dress], turn, categoryPlan, vocabulary);
  assert.equal(reply.products.length, 1);
  assert.match(reply.optional_question, /What occasion/);
  assert.equal(reply.pending, null);
});
check("The optional question enters history and does not overwrite preferences", () => {
  const saved = session({ occasion: null });
  const turn = makeTurn(saved, "Show Clothing");
  const value = { ...plan(turn, "new_search"), changes:[{scope:"item",field:"category",operation:"set",value:"Clothing",evidence:"Clothing"}] };
  const reply = finishConversationTurn([dress], turn, value, vocabulary);
  const accepted = acceptReply(turn, reply).session;
  assert.match(accepted.history.at(-1).content, /What occasion/);
  assert.equal(accepted.scopes.item.max_price, null);
});
check("A recent occasion question is not repeatedly appended", () => {
  const saved = newSession();
  saved.history = [{role:"assistant", content:"What occasion are you shopping for?"}];
  const turn = makeTurn(saved, "Clothing");
  const value = { ...plan(turn, "new_search"), changes:[{scope:"item",field:"category",operation:"set",value:"Clothing",evidence:"Clothing"}] };
  const reply = finishConversationTurn([dress], turn, value, vocabulary);
  assert.equal(reply.optional_question, null);
});
check("A missing requested colour does not silently become another colour", () => {
  const { result } = run([blue]);
  assert.equal(result.status, "no_match");
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.alternatives, []);
  assert.equal(result.can_preview_other_colours, true);
});
check("Explicit colour preview returns labelled alternatives without mutating scopes", () => {
  const saved = session();
  const before = JSON.stringify(saved);
  const { result, turn } = run([blue], {}, { session: saved, preview: true });
  assert.equal(result.status, "alternatives");
  assert.equal(result.alternative_kind, "colour_preview");
  assert.match(result.alternatives[0].differences[0], /Blue.*Lavender/);
  assert.deepEqual(result.proposed_scopes.item.preferred_colours, ["Lavender"]);
  assert.deepEqual(acceptReply(turn, result).session.scopes.item.preferred_colours, ["Lavender"]);
  assert.equal(JSON.stringify(saved), before);
});
check("The browser rejects an unrequested colour preview", () => {
  const { result } = run([blue], {}, { preview: true });
  assert.throws(() => acceptReply(makeTurn(session(), "Show my request"), result), /explicit preview/);
});
check("A shared required colour is not bypassed by the preview flag", () => {
  const saved = session();
  saved.scopes.shared.preferred_colours = ["Lavender"];
  const { result } = run([blue], {}, { session: saved, preview: true });
  assert.deepEqual(result.alternatives, []);
  assert.deepEqual(result.proposed_scopes.shared.preferred_colours, ["Lavender"]);
});
check("Preview still enforces maximum including zero and minimum price", () => {
  for (const changes of [{ max_price: 0 }, { max_price: 44 }, { min_price: 46 }]) {
    const { result } = run([blue], changes, { preview: true });
    assert.deepEqual(result.alternatives, []);
  }
  assert.equal(run([blue], { max_price: 45 }, { preview: true }).result.alternatives.length, 1);
});
check("Preview keeps the requested size and rejects invalid stock", () => {
  for (const change of [{ sizes_available:["12"] }, { stock_qty:0 }, { stock_qty:1.5 }, { is_available:false }, { sizes_available:[] }]) {
    assert.deepEqual(run([{ ...blue, ...change }], { size:"10" }, { preview:true }).result.alternatives, []);
  }
});
check("Preview preserves colour exclusions including missing colours", () => {
  for (const product of [brown, { ...brown, colour:null }]) {
    assert.deepEqual(run([product], { excluded_colours:["Brown"] }, { preview:true }).result.alternatives, []);
  }
});
check("Preview never relaxes material or item category", () => {
  assert.deepEqual(run([{ ...blue, material:"Silk" }], { material:"Cotton" }, { preview:true }).result.alternatives, []);
  assert.deepEqual(run([bag], {}, { preview:true }).result.alternatives, []);
});
check("Unsupported requirements remain unverified and blocking", () => {
  const saved = session();
  saved.scopes.unresolved_item = ["Cat pictures on the fabric"];
  const { result } = run([dress], {}, { session:saved });
  assert.equal(result.status, "needs_clarification");
  assert.match(result.message, /can't verify/);
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.alternatives, []);
});
check("Pending questions cannot be bypassed by colour-preview shortcuts", () => {
  const saved = session();
  saved.pending = {action:"refine",reference:null,goal:"clarify",question:"Which one?",before_scopes:saved.scopes};
  const turn = makeTurn(saved, "Explore other colours", null, undefined, true);
  assert.throws(() => shortcutPlan(turn), /pending/);
});
check("Response checks reject weakened alternative size, price or material filters", () => {
  const { result } = run([blue], {max_price:50, size:"10", material:"Cotton"}, {preview:true});
  for (const change of [{max_price:100}, {size:null}, {material:null}]) {
    assert.throws(() => TurnReplySchema.parse({...result,alternatives_preferences:{...result.alternatives_preferences,...change}}));
  }
});
check("Response checks reject duplicate IDs across result sections", () => {
  const { result } = run([dress, formal]);
  assert.throws(() => TurnReplySchema.parse({...result,alternatives:[{...result.alternatives[0],product_id:"D1"}]}));
});
check("Alternative cards must explicitly disclose their differences", () => {
  const { result } = run([formal]);
  assert.throws(() => TurnReplySchema.parse({...result,alternatives:[{...result.alternatives[0],differences:[]}]}));
});
check("Conversation references follow displayed exact-then-alternative order", () => {
  const { result, turn } = run([dress, formal]);
  assert.deepEqual(acceptReply(turn, result).session.context.latest.map(p=>p.product_id),["D1","D2"]);
});
check("Technical or blocking results cannot contain an alternatives list", () => {
  const { result } = run([formal]);
  assert.throws(() => TurnReplySchema.parse({...result,status:"no_match"}));
});
check("No photo is a valid result, not a fabricated category photograph", () => {
  assert.equal(run([dress]).result.products[0].image_src, null);
});
check("A shared context requirement is not relaxed into an alternative", () => {
  const saved = session();
  saved.scopes.shared.style = "Relaxed";
  const { result } = run([formal], {}, { session: saved });
  assert.equal(result.status, "no_match");
  assert.deepEqual(result.alternatives, []);
});
check("The colour preview also retains shared context requirements", () => {
  const saved = session();
  saved.scopes.shared.style = "Relaxed";
  const { result } = run([{ ...blue, style: "Formal" }], {}, { session: saved, preview: true });
  assert.deepEqual(result.alternatives, []);
});
console.log(`\n${passed} shopping-presentation checks passed.`);
