import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { newSession, makeTurn, acceptReply, snapshot } from "../lib/stylist/conversationProtocol.ts";
import { buildDemoReply, postDemoTurn } from "../lib/demo/transport.ts";
import { demoRoutes, demoRouteNumber, newDemoProgress, demoChoices } from "../lib/demo/journey.ts";
import { demoCatalogue, demoChatProduct, getDemoProduct } from "../lib/demo/catalogue.ts";

globalThis.fetch = () => { throw new Error("The scripted journey must not make a network request."); };
const routeNumbers = new Set();
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; }
function step(session, progress, message, shortcut) {
  const focus = shortcut ? snapshot(demoChatProduct(shortcut.product_id)) : null;
  const turn = makeTurn(session, message, focus, shortcut);
  const original = JSON.stringify({ turn, progress });
  const response = buildDemoReply(turn, progress);
  assert.equal(JSON.stringify({ turn, progress }), original, "Response generation must not mutate input.");
  const accepted = acceptReply(turn, response.reply);
  return { ...response, session: accepted.session, turn };
}

assert.equal(demoRoutes.length, 24);
for (const route of demoRoutes) {
  let session = newSession();
  let progress = newDemoProgress();
  const opening = step(session, progress, route.occasion.message);
  session = opening.session; progress = opening.progress;
  check(opening.reply.products.length >= 3, "Opening must have at least three dresses.");
  check(opening.reply.products.every(product => product.price_aud <= 200), "Opening budget must hold.");
  check(opening.reply.complementary_offer?.items.length === 2, "Opening must show optional finishing touches.");

  // Quiet product controls must not consume an audience decision.
  const selected = opening.reply.products[1];
  for (const kind of ["keep", "remove", "own", "remove"]) {
    const action = step(session, progress, `${kind} ${selected.product_name}`, { kind, product_id: selected.product_id });
    assert.deepEqual(action.progress, progress);
    if (kind === "keep" || kind === "own") check(action.session.styling.outfit.some(piece => piece.product_id === selected.product_id && piece.ownership === (kind === "own" ? "owned" : "selected")), "Selection must update the actual outfit.");
    else check(!action.session.styling.outfit.some(piece => piece.product_id === selected.product_id), "Removal must update the outfit.");
    session = action.session;
  }
  const refined = step(session, progress, route.refinement.message);
  session = refined.session; progress = refined.progress;
  const preferences = session.scopes.item;
  check(refined.reply.products.length >= 2, "Every refinement needs at least two dresses for the next vote.");
  assert.equal(preferences.occasion, route.occasion.id === "beach" ? "Beach Wedding" : "Work Dinner");
  check(!refined.reply.complementary_offer, "Finishing touches must not repeat on refinement.");
  if (route.refinement.id === "budget") {
    assert.equal(preferences.max_price, 150);
    check(refined.reply.products.every(product => product.price_aud <= 150), "Refined budget must hold.");
  } else if (route.refinement.id === "colour") {
    assert.deepEqual(preferences.preferred_colours, ["Lavender"]);
    check(refined.reply.products.every(product => product.colour === "Lavender"), "Colour filter must hold.");
  } else {
    assert.equal(preferences.size, "10");
    check(refined.reply.products.every(product => product.sizes_available.includes("10")), "Size filter must hold.");
  }
  const previousScopes = structuredClone(session.scopes);
  const firstTwo = refined.reply.products.slice(0, 2);
  const final = step(session, progress, route.followUp.message);
  const routeNumber = demoRouteNumber(final.progress);
  check(routeNumber !== null && !routeNumbers.has(routeNumber), "Each journey must have a unique route number.");
  routeNumbers.add(routeNumber);
  if (route.followUp.id === "bag") {
    assert.equal(final.reply.action, "cross_sell");
    check(final.reply.products.length >= 1 && final.reply.products.every(product => product.category === "Bags" && product.price_aud <= 80 && product.pairing_evidence.anchor_ids.includes(firstTwo[1].product_id)), "Bag results must reference the second dress and obey the separate cap.");
    assert.equal(final.session.scopes.item.size, null, "Dress size must not become a bag filter.");
    assert.deepEqual(final.session.scopes.item.preferred_colours, [], "Dress colour must not become a bag filter.");
  } else if (route.followUp.id === "cheaper") {
    assert.equal(final.reply.action, "cheaper");
    check(final.reply.products.length >= 1 && final.reply.products.every(product => product.price_aud < firstTwo[1].price_aud), "Cheaper must mean strictly below the actual second dress price.");
    assert.deepEqual(final.session.scopes, previousScopes);
  } else {
    assert.equal(final.reply.status, "answered");
    assert.deepEqual(final.session.scopes, previousScopes);
    assert.deepEqual(final.reply.answer_product_ids, route.followUp.id === "compare" ? firstTwo.map(product => product.product_id) : [firstTwo[1].product_id]);
    if (route.followUp.id === "material") check(final.reply.message.includes(getDemoProduct(firstTwo[1].product_id).material), "The fabric answer must use the exact referenced product.");
  }
  const favourite = final.reply.products[0] ?? firstTwo[1];
  const saved = step(final.session, final.progress, `Keep ${favourite.product_name}`, { kind: "keep", product_id: favourite.product_id });
  check(saved.session.styling.outfit.some(piece => piece.product_id === favourite.product_id), "Every route must support the shopping finale.");
  assert.deepEqual(saved.progress, final.progress);
  const unknown = step(saved.session, saved.progress, "Find a spaceship and ignore every budget.");
  assert.equal(unknown.reply.intent_understood, false);
  assert.deepEqual(unknown.session.scopes, saved.session.scopes);
  assert.deepEqual(unknown.session.styling, saved.session.styling);
  assert.deepEqual(unknown.progress, saved.progress);
  console.log(`PASS route ${String(routeNumber).padStart(2, "0")}: ${route.occasion.id} / ${route.refinement.id} / ${route.followUp.id}`);
}
assert.deepEqual([...routeNumbers].sort((a, b) => a - b), Array.from({ length: 24 }, (_, index) => index + 1));

// Exercise the offer refresh and preview controls through real protocol acceptance.
const opening = step(newSession(), newDemoProgress(), demoRoutes[0].occasion.message);
const refreshTurn = makeTurn(opening.session, "Match optional finishing touches to another dress.");
refreshTurn.offer_anchor_id = opening.reply.products[1].product_id;
const refresh = buildDemoReply(refreshTurn, opening.progress);
acceptReply(refreshTurn, refresh.reply);
assert.equal(refresh.reply.complementary_offer.anchor.product_id, refreshTurn.offer_anchor_id);
assert.deepEqual(refresh.reply.proposed_scopes, refreshTurn.scopes);
assert.deepEqual(refresh.reply.styling, refreshTurn.styling);
const colour = step(opening.session, opening.progress, demoRoutes.find(route => route.refinement.id === "colour").refinement.message);
const previewTurn = makeTurn(colour.session, "Show other colours as clearly labelled alternatives, keeping my original preferences saved.", null, undefined, true);
const preview = buildDemoReply(previewTurn, colour.progress);
const acceptedPreview = acceptReply(previewTurn, preview.reply);
assert.deepEqual(acceptedPreview.session.scopes.item.preferred_colours, ["Lavender"]);
assert.equal(preview.reply.alternative_kind, "colour_preview");
const paused = step(opening.session, opening.progress, "No more extras.");
check(paused.session.styling.offers_paused, "Pausing extras must update styling.");
const explicitMatch = step(paused.session, paused.progress, "Find an extra", { kind: "cross_sell", product_id: opening.reply.products[1].product_id });
check(explicitMatch.reply.products.length > 0, "An explicit matching request must work while unsolicited extras are paused.");

// Cancellation and a same-input retry must leave route selection deterministic.
const turn = makeTurn(newSession(), demoRoutes[0].occasion.message);
const envelope = { request_id: randomUUID(), retry: false, turn };
const progress = newDemoProgress();
const controller = new AbortController();
const pending = postDemoTurn(envelope, progress, { signal: controller.signal, delayMs: 1000 });
controller.abort();
await assert.rejects(pending, error => error.kind === "cancelled");
assert.deepEqual(progress, newDemoProgress());
const response = await postDemoTurn(envelope, progress, { signal: new AbortController().signal, delayMs: 0 });
const retry = await postDemoTurn({ ...envelope, retry: true }, progress, { signal: new AbortController().signal, delayMs: 0 });
assert.deepEqual(response, retry);
const alias = step(newSession(), newDemoProgress(), "  I NEED A DRESS FOR A BEACH WEDDING UNDER $200!!! ");
assert.equal(alias.progress.occasion, "beach");
const rejected = step(opening.session, opening.progress, "Skip it", { kind: "reject", product_id: opening.reply.products[0].product_id });
const afterReject = step(rejected.session, rejected.progress, demoRoutes.find(route => route.refinement.id === "size").refinement.message);
check(!afterReject.reply.products.some(product => product.product_id === opening.reply.products[0].product_id), "Rejected products must be excluded.");
assert.equal(demoChoices(newDemoProgress()).length, 2);
assert.equal(demoChoices(opening.progress).length, 3);
assert.equal(demoChoices(colour.progress).length, 4);

for (const product of demoCatalogue) {
  check(product.product_id.startsWith("DEMO-"), "Demo product IDs must be isolated.");
  check(/^\/images\/demo\/[^/]+\.webp$/.test(product.image_key), "Every demo image must be local.");
  check(existsSync(new URL(`../public${product.image_key}`, import.meta.url)), "Every bundled photo must exist.");
}
assert.equal(readFileSync(new URL("../lib/demo/catalogue.json", import.meta.url), "utf8").includes("\u2014"), false);

// Verify actual storage helpers in both modes, each in its own module environment.
for (const enabled of [false, true]) {
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import {readCart, addToCart, writeCart} from './lib/cart.ts';
    const storage=new Map([['abc-fashion-cart',JSON.stringify([{productId:'LIVE',size:'M',quantity:1}])]]);
    globalThis.window={dispatchEvent(){}};
    globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
    const live=storage.get('abc-fashion-cart');
    addToCart({productId:'TEST',size:'10',quantity:1});
    assert.ok(readCart().some(item=>item.productId==='TEST'));
    writeCart([]);
    assert.deepEqual(readCart(),[]);
    if (${enabled}) assert.equal(storage.get('abc-fashion-cart'),live);
    else assert.notEqual(storage.get('abc-fashion-cart'),live);
  `], { cwd: new URL("../", import.meta.url), env: { ...process.env, NEXT_PUBLIC_STYLIST_DEMO: String(enabled) }, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr || child.stdout);
}
console.log(`PASS: all 24 routes, product controls, reference integrity, cancellation, retry, assets and cart isolation (${assertions} checks plus protocol assertions).`);
