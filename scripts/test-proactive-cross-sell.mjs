import assert from "node:assert/strict";
import { allCollectionSession as newSession } from "./fixtures/collection-session.mjs";
import { acceptReply, makeTurn, snapshot, TurnReplySchema } from "../lib/stylist/conversationProtocol.ts";
import { finishConversationTurn, shortcutPlan } from "../lib/stylist/conversationTurn.ts";
import { messageProductReference, resolveProductReference } from "../lib/stylist/productReference.ts";
import { explicitNoExtras } from "../lib/stylist/offerPreferences.ts";
import { dismissComplementaryOffer, restoreOfferMemory, saveOfferMemory, clearOfferMemory } from "../lib/stylist/offerMemory.ts";
import { explicitCollection, requestedClothing } from "../lib/stylist/collectionPreference.ts";

// Isolated, synthetic products and interpreter decisions. No provider/database calls.
import { dress, bag, shoes, rows, vocabulary } from "./fixtures/proactive-cross-sell.mjs";
function saved() {
  const session = newSession();
  Object.assign(session.scopes.item, { category: "Clothing", subcategory: "Dresses", gender: "Women", occasion: "Beach Wedding",
    preferred_colours: ["Blue"], size: "10", max_price: 200, material: "Cotton" });
  return session;
}
function run(session = saved(), catalogue = rows, message = "Show dresses for my beach wedding.", customPlan) {
  const turn = makeTurn(session, message);
  const plan = customPlan ?? { action: "refine", intent_evidence: message, reference: null, changes: [], question: null, continuation: false };
  const reply = finishConversationTurn(catalogue, turn, plan, vocabulary);
  return { turn, reply, session: acceptReply(turn, reply).session };
}
let passed = 0;
function check(name, test) { test(); passed++; console.log(`PASS: ${name}`); }

check("The first beach-wedding result proactively shows actual bag and shoe products", () => {
  const { reply, session } = run();
  assert.equal(reply.action, "refine"); assert.equal(reply.pending, null);
  assert.deepEqual(reply.complementary_offer.items.map(item => item.product.product_id), ["B1", "S1"]);
  assert.match(reply.message, /optional finishing touches/);
  assert.equal(reply.complementary_offer.anchor.product_id, "D1");
  assert.equal(reply.complementary_offer.anchor_ownership, "example");
  assert.equal(reply.products[0].extra_target, "Bags"); // enriched rule, no legacy target
  assert.equal(session.task.complementary_shown, true);
  assert.deepEqual(session.styling.outfit, []);
});
check("Showing extras preserves primary ordering, focus, saved preferences and cart IDs", () => {
  const initial = saved(); initial.cart_product_ids = ["unrelated-cart-item"];
  const before = structuredClone(initial);
  const { reply, session } = run(initial);
  assert.deepEqual(initial, before);
  assert.deepEqual(session.scopes, initial.scopes);
  assert.deepEqual(session.context.latest.map(product => product.product_id), reply.products.map(product => product.product_id));
  assert.deepEqual(session.context.complementary.map(product => product.product_id), ["B1", "S1"]);
  assert.equal(session.context.focused, null);
  assert.deepEqual(session.cart_product_ids, initial.cart_product_ids);
});
check("Additional-item size, colour, material and cap are independent of the dress", () => {
  const { reply } = run();
  for (const item of reply.complementary_offer.items) {
    assert.equal(item.preferences.size, null); assert.equal(item.preferences.material, null);
    assert.equal(item.preferences.max_price, null); assert.deepEqual(item.preferences.preferred_colours, []);
    assert.equal(item.preferences.occasion, "Beach Wedding");
  }
  const expensive = run(saved(), [dress, { ...bag, price_aud: 250 }]).reply;
  assert.equal(expensive.complementary_offer.items[0].product.price_aud, 250);
  assert.equal(expensive.complementary_offer.combined_limit_aud, null);
});
check("An initial new-search brief also includes extras without a second prompt", () => {
  const message = "Find a dress for a beach wedding under A$200.";
  const { reply } = run(newSession(), rows, message, { action: "new_search", intent_evidence: message, reference: null,
    changes: [
      { scope: "item", field: "category", operation: "set", value: "Clothing", evidence: "dress" },
      { scope: "item", field: "subcategory", operation: "set", value: "Dresses", evidence: "dress" },
      { scope: "item", field: "occasion", operation: "set", value: "Beach Wedding", evidence: "beach wedding" },
      { scope: "item", field: "max_price", operation: "set", value: 200, evidence: "under A$200" },
    ], question: null, continuation: false });
  assert.ok(reply.complementary_offer); assert.equal(reply.action, "new_search");
});
check("A trailing request to browse without choosing a size preserves the original dress and collection", () => {
  const message = "Help me find a women's dress for a beach wedding, up to 200 AUD. Let me browse without choosing a size.";
  assert.equal(explicitCollection(message).choice, "Women");
  assert.equal(requestedClothing(message).subcategory, "Dresses");
});
check("No-extras variants suppress products and persist the preference", () => {
  for (const text of ["Only a dress for my beach wedding.", "Just the dress, please.", "No extras.",
    "I only need a dress.", "I only need a women's beach wedding dress, maximum 200 AUD.",
    "No more extras.", "I don't want any extras.", "A dress only."]) {
    assert.ok(explicitNoExtras(text), text);
    const { reply, session } = run(saved(), rows, text);
    assert.equal(reply.complementary_offer, null, text);
    assert.equal(session.styling.offers_paused, true, text);
  }
  assert.equal(explicitNoExtras("Not only a dress for my wedding."), null);
});
check("An existing pause and a local dismissal both suppress subsequent offers", () => {
  for (const pause of [true, false]) {
    const initial = dismissComplementaryOffer(saved(), pause);
    const { reply } = run(initial);
    assert.equal(reply.complementary_offer, null);
    assert.equal(initial.styling.offers_paused, pause);
  }
});
check("Owned and selected accessory roles are not recommended again", () => {
  const explicit = run(saved(), rows, "I already own a bag and shoes. Show dresses for my beach wedding.");
  assert.equal(explicit.reply.complementary_offer, null);
  assert.deepEqual(explicit.session.styling.owned_categories, ["Bags", "Shoes"]);
  const initial = saved(); initial.styling.owned_categories = ["Bags"];
  assert.deepEqual(run(initial).reply.complementary_offer.items.map(item => item.product.category), ["Shoes"]);
  initial.styling.external_items = [{ external_id: "external-1", source: "customer_description",
    category: "Shoes", description: "my beige flats", product_type: "Flats", colour: "Beige", occasion: null }];
  assert.equal(run(initial).reply.complementary_offer, null);
  const selected = saved(); selected.styling.outfit = [{ ...snapshot(bag), ownership: "selected" }];
  assert.deepEqual(run(selected).reply.complementary_offer.items.map(item => item.product.category), ["Shoes"]);
});
check("Primary no-match, unknown occasion and unresolved requirements do not trigger offers", () => {
  assert.equal(run(saved(), [bag, shoes]).reply.complementary_offer, null);
  const noOccasion = saved(); noOccasion.scopes.item.occasion = null;
  assert.equal(run(noOccasion, rows, "Show my current dresses.").reply.complementary_offer, null);
  const unresolved = saved(); unresolved.scopes.unresolved_item = ["certified sand-safe"];
  const { reply } = run(unresolved); assert.equal(reply.status, "needs_clarification"); assert.equal(reply.complementary_offer, null);
});
check("Explicit provisional consent resumes unchanged filters, discloses the unknown and suppresses offers", () => {
  const initial = newSession(); Object.assign(initial.scopes.item, { category: "Shoes", gender: "Women", preferred_colours: ["Black"], max_price: 150 });
  initial.scopes.unresolved_item = ["verified waterproof"];
  initial.pending = { action: "new_search", reference: null, goal: "Find verified waterproof shoes.", question: "Keep the requirement?", before_scopes: initial.scopes };
  const turn = makeTurn(initial, "Browse provisional options with waterproofing unverified. Keep black and A$150.");
  const plan = shortcutPlan(turn); assert.equal(plan.action, "refine"); assert.deepEqual(plan.changes, []);
  const blackShoe = { ...shoes, colour: "Black" };
  const reply = finishConversationTurn([blackShoe], turn, plan, { ...vocabulary, rows: [...rows, blackShoe] });
  assert.equal(reply.status, "alternatives"); assert.equal(reply.complementary_offer, null);
  assert.ok(reply.alternatives.every(product => product.unverified_requirements.includes("verified waterproof")));
  assert.equal(reply.proposed_scopes.item.max_price, 150);
  assert.equal(shortcutPlan(makeTurn(initial, "Browse provisional options with waterproofing unverified. Keep black and A$160.")), null);
});
check("Missing rules, unavailable extras and corrupt optional rules preserve dress results", () => {
  for (const catalogue of [[{ ...dress, pairing_categories: [] }], [dress], [dress, { ...bag, stock_qty: 0 }],
    [dress, { ...bag, is_available: false }], [{ ...dress, pairing_categories: [null] }]]) {
    const { reply } = run(saved(), catalogue);
    assert.ok(reply.products.length); assert.equal(reply.complementary_offer, null);
  }
});
check("Unavailable first category falls through to the next approved category", () => {
  const { reply } = run(saved(), [dress, shoes]);
  assert.deepEqual(reply.complementary_offer.items.map(item => item.product.product_id), ["S1"]);
});
check("Shared exclusions, material and per-item price restrictions apply to extras", () => {
  const initial = saved(); initial.scopes.shared.excluded_colours = ["Beige"];
  assert.equal(run(initial).reply.complementary_offer, null);
  initial.scopes.shared.excluded_colours = []; initial.scopes.shared.material = "Cotton";
  assert.equal(run(initial).reply.complementary_offer, null);
  initial.scopes.shared.material = null; initial.scopes.shared.max_price = 160;
  assert.equal(run(initial, [dress, { ...bag, price_aud: 170 }]).reply.complementary_offer, null);
});
check("Rejected/cart products and mismatched occasions cannot pad the offer", () => {
  const initial = saved(); initial.cart_product_ids = ["B1"]; initial.styling.rejected_ids = ["S1"];
  assert.equal(run(initial).reply.complementary_offer, null);
  assert.equal(run(saved(), [dress, { ...bag, occasion: "Work" }]).reply.complementary_offer, null);
});
check("A combined cap covers the anchor and all proposed additions together", () => {
  const initial = saved(); initial.styling.purchase_budget = { limit_aud: 250, product_ids: [] };
  const { reply } = run(initial, [dress, bag, shoes]);
  assert.equal(reply.complementary_offer.total_aud, 195);
  assert.deepEqual(reply.complementary_offer.items.map(item => item.product.product_id), ["B1"]);
  initial.styling.purchase_budget.limit_aud = 265;
  assert.equal(run(initial).reply.complementary_offer.total_aud, 265);
});
check("Selected anchors are counted once and owned anchors cost zero", () => {
  for (const ownership of ["selected", "owned"]) {
    const initial = saved(); initial.styling.outfit = [{ ...snapshot(dress), ownership }];
    initial.styling.purchase_budget = { limit_aud: ownership === "selected" ? 265 : 115, product_ids: ownership === "selected" ? ["D1"] : [] };
    const { reply } = run(initial, [dress, bag, shoes]);
    assert.equal(reply.complementary_offer.base_total_aud, ownership === "selected" ? 150 : 0);
    assert.equal(reply.complementary_offer.total_aud, ownership === "selected" ? 265 : 115);
    assert.equal(reply.complementary_offer.anchor_ownership, ownership);
  }
});
check("Exact totals at the cap work; zero remaining allowance omits the offer", () => {
  const initial = saved(); initial.styling.purchase_budget = { limit_aud: 195, product_ids: [] };
  assert.equal(run(initial, [dress, bag]).reply.complementary_offer.total_aud, 195);
  initial.styling.purchase_budget.limit_aud = 150;
  assert.equal(run(initial, [dress, bag]).reply.complementary_offer, null);
});
check("Refinements and truncated history do not repeat the same pitch", () => {
  const first = run(); first.session.history = [];
  assert.equal(run(first.session, rows, "Show more dresses.").reply.complementary_offer, null);
});
check("Reference groups keep ordinals primary and named/role references address extras", () => {
  const { session } = run();
  assert.equal(resolveProductReference(session.context, { kind: "position", position: 2, subcategory: null }).product_id, "D2");
  for (const [message, expected] of [["Why the bag?", "B1"], ["Why the first bag?", "B1"], ["Why the second dress?", "D2"], ["Why Synthetic Neutral Clutch?", "B1"]]) {
    assert.equal(messageProductReference(session.context, message).reference.value, expected, message);
  }
});
check("Changing the anchor refreshes extras without changing primary context or outfit", () => {
  const first = run(); const turn = makeTurn(first.session, "Match optional finishing touches to Synthetic Second Beach Dress.");
  turn.offer_anchor_id = "D2";
  const reply = finishConversationTurn(rows, turn, shortcutPlan(turn), vocabulary);
  const accepted = acceptReply(turn, reply).session;
  assert.equal(reply.offer_refresh, true); assert.equal(reply.complementary_offer.anchor.product_id, "D2");
  assert.deepEqual(reply.products, []); assert.deepEqual(accepted.context.latest, first.session.context.latest);
  assert.deepEqual(accepted.scopes, first.session.scopes); assert.deepEqual(accepted.styling, first.session.styling);
  assert.ok(accepted.context.complementary.every(item => item.recommendation_context.anchor_ids.includes("D2")));
});
check("An unknown anchor cannot refresh, and another anchor cannot be substituted", () => {
  const first = run(); const turn = makeTurn(first.session, "Match optional finishing touches.");
  turn.offer_anchor_id = "unknown";
  const reply = finishConversationTurn(rows, turn, shortcutPlan(turn), vocabulary);
  assert.equal(reply.complementary_offer, null);
  assert.throws(() => acceptReply(turn, { ...reply, complementary_offer: first.reply.complementary_offer }));
});
check("Questions about an addition retain its pairing anchor and avoid the dress-only budget", () => {
  const first = run(saved(), [dress, { ...bag, price_aud: 250 }]);
  const message = "Why the bag?"; const turn = makeTurn(first.session, message);
  const reply = finishConversationTurn([dress, { ...bag, price_aud: 250 }], turn, {
    action: "none", intent_evidence: message, reference: null, changes: [], question: null, continuation: false,
    answer: { kind: "product", topics: ["recommendation"], references: [{ kind: "id", value: "B1" }], purpose: null, continuation: false },
  }, vocabulary);
  assert.deepEqual(reply.answer_product_ids, ["B1"]); assert.match(reply.message, /Synthetic Blue Beach Dress/);
  assert.doesNotMatch(reply.message, /exceeds your saved|within your A\$200/);
  assert.equal(reply.complementary_offer, null); acceptReply(turn, reply);
});
check("Saving an addition retains recommendation context and leaves the dress unselected", () => {
  const first = run(); const product = first.reply.complementary_offer.items[0].product;
  const turn = makeTurn(first.session, `Keep ${product.product_name} for my outfit.`, snapshot(product), { kind: "keep", product_id: product.product_id });
  const reply = finishConversationTurn(rows, turn, shortcutPlan(turn), vocabulary);
  const session = acceptReply(turn, reply).session;
  assert.equal(session.scopes.item.category, "Clothing");
  assert.deepEqual(session.styling.outfit.map(piece => piece.product_id), ["B1"]);
  assert.deepEqual(session.styling.outfit[0].recommendation_context.anchor_ids, ["D1"]);
});
check("Offer preferences survive reload without persisting shopping messages or identities", () => {
  const data = new Map(); const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const initial = dismissComplementaryOffer(run().session, true); saveOfferMemory(initial, storage);
  const text = [...data.values()][0]; assert.doesNotMatch(text, /D1|B1|beach|message|product/);
  const restored = restoreOfferMemory(newSession(), storage);
  assert.equal(restored.task.complementary_shown, true); assert.equal(restored.task.complementary_dismissed, true); assert.equal(restored.styling.offers_paused, true);
  clearOfferMemory(storage); assert.equal(restoreOfferMemory(newSession(), storage).styling.offers_paused, false);
  assert.doesNotThrow(() => saveOfferMemory(initial, { setItem() { throw new Error("disabled"); } }));
});
check("Explicit resumption clears dismissal but an explicit cross-sell keeps the pause", () => {
  const initial = dismissComplementaryOffer(saved(), true);
  const message = "Resume extra suggestions.";
  const { session } = run(initial, rows, message, { action: "none", intent_evidence: message, reference: null,
    changes: [], question: null, continuation: false,
    styling_intent: { preferences: [], outfit_changes: [], owned_categories: [], offers: { paused: false, evidence: message } } });
  assert.equal(session.task.complementary_dismissed, false); assert.equal(session.styling.offers_paused, false);
  assert.ok(run(session).reply.complementary_offer);
  const turn = makeTurn(initial, "Find an extra for Synthetic Blue Beach Dress.", snapshot(dress), { kind: "cross_sell", product_id: "D1" });
  const reply = finishConversationTurn(rows, turn, shortcutPlan(turn), vocabulary);
  assert.equal(reply.action, "cross_sell"); assert.equal(reply.styling.offers_paused, true); assert.equal(reply.complementary_offer, null);
});
check("A new task can offer again while persistent pauses stay paused", () => {
  const first = run();
  const message = "Start a new search for a beach wedding dress.";
  const turn = makeTurn(first.session, message);
  const plan = { action: "new_search", intent_evidence: message, reference: null, changes: [
    { scope: "item", field: "category", operation: "set", value: "Clothing", evidence: "dress" },
    { scope: "item", field: "subcategory", operation: "set", value: "Dresses", evidence: "dress" },
    { scope: "item", field: "occasion", operation: "set", value: "Beach Wedding", evidence: "beach wedding" },
  ], question: null, continuation: false };
  assert.ok(finishConversationTurn(rows, turn, plan, vocabulary).complementary_offer);
  turn.styling.offers_paused = true;
  assert.equal(finishConversationTurn(rows, turn, plan, vocabulary).complementary_offer, null);
});
check("Protocol rejects ungrounded, duplicate, mispriced and over-budget offers", () => {
  const { reply } = run();
  const bad = change => assert.throws(() => TurnReplySchema.parse({ ...reply, complementary_offer: { ...reply.complementary_offer, ...change } }));
  bad({ total_aud: 1 }); bad({ combined_limit_aud: 150 });
  bad({ items: [{ ...reply.complementary_offer.items[0], product: { ...reply.complementary_offer.items[0].product, pairing_evidence: undefined } }] });
  bad({ items: [reply.complementary_offer.items[0], reply.complementary_offer.items[0]] });
});
check("The rollout switch suppresses only optional previews", () => {
  const before = process.env.STYLIST_PROACTIVE_CROSS_SELL_ENABLED;
  try { process.env.STYLIST_PROACTIVE_CROSS_SELL_ENABLED = "false"; const { reply } = run(); assert.equal(reply.complementary_offer, null); assert.equal(reply.products.length, 2); }
  finally { if (before === undefined) delete process.env.STYLIST_PROACTIVE_CROSS_SELL_ENABLED; else process.env.STYLIST_PROACTIVE_CROSS_SELL_ENABLED = before; }
});
console.log(`\n${passed} proactive cross-sell checks passed. No network calls.`);
