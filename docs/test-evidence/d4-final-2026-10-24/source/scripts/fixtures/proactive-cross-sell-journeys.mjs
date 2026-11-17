const eq = (path, value) => ({ path, op: "eq", value });
const unchanged = path => eq(`state.${path}`, { ref: `before.${path}` });
const ref = path => ({ ref: `bindings.${path}` });
const dressRequest = "Find a women's dress for a beach wedding under A$200. I don't know my size yet.";
export const proactiveJourneys = [
  { id: "P01", name: "Proactive beach-wedding products and references", mode: "live",
    variants: [dressRequest, "Women's beach-wedding dress please, A$200 max; size undecided.",
      "Help me find a women's dress for a beach wedding, up to 200 AUD. Let me browse without choosing a size."],
    turns: [
      { prompt: dressRequest, needProducts: 2, needComplementary: true, complementaryBudget: "separate",
        products: { subcategory: "Dresses", max: 200 }, bind: {
          dress: { index: 0 }, secondDress: { index: 1, source: "primary" }, extra: { index: 0, source: "complementary" },
        }, checks: [
        eq("state.styling.outfit.length", 0), eq("state.scopes.item.size", null), eq("state.scopes.item.max_price", 200),
      ] },
      { prompt: "Why did you suggest {{extra.product_name}}, and what does it cost?", noProducts: true, checks: [eq("reply.status", "answered"),
        eq("reply.answer_product_ids", [ref("extra.product_id")]), unchanged("scopes"), unchanged("context.latest"), eq("reply.complementary_offer", null)] },
      { prompt: "What material is the second dress made of?", noProducts: true, checks: [eq("reply.status", "answered"),
        eq("reply.answer_product_ids", [ref("secondDress.product_id")]), unchanged("scopes"), unchanged("context.latest"), eq("reply.complementary_offer", null)] },
      { prompt: "Keep {{extra.product_name}} for my outfit.", noProducts: true, checks: [unchanged("scopes"),
        { path: "state.styling.outfit", op: "piece", value: { product_id: ref("extra.product_id"), ownership: "selected" } },
        eq("state.styling.outfit.length", 1), eq("reply.complementary_offer", null)] },
      { prompt: "Show more women's beach-wedding dresses, keeping the A$200 maximum.", needProducts: 1,
        products: { subcategory: "Dresses", max: 200 }, checks: [eq("reply.complementary_offer", null),
          eq("state.scopes.item.max_price", 200), eq("state.task.complementary_shown", true)] },
    ], expected: "Show actual complementary products without another prompt; preserve the dress-only cap and primary ordinals, save only the chosen addition, and do not repeat the offer.",
    review: ["Prerequisite: at least two eligible beach-wedding dresses under A$200 and an approved available complementary product.",
      "Assess the usefulness and tone of the optional offer and supported pairing reasons.",
      "In the browser, check separate prices, rematching, Hide these suggestions, No more extras and dismissal after reload."] },
  { id: "P02", name: "No extras followed by an explicit matching request", mode: "live",
    variants: ["Find a women's dress for a beach wedding under A$200. Only a dress, no extras.",
      "I only need a women's beach wedding dress, maximum 200 AUD.",
      "Just a women's dress for a beach wedding please, under A$200; no extra recommendations."],
    turns: [
      { prompt: "Find a women's dress for a beach wedding under A$200. Only a dress, no extras.", needProducts: 1,
        products: { subcategory: "Dresses", max: 200 },
        bind: { dress: { index: 0, source: "primary" } }, checks: [eq("reply.complementary_offer", null), eq("state.styling.offers_paused", true)] },
      { prompt: "Now find matching {{dress.extra_target}} to go with {{dress.product_name}}.", needProducts: 1,
        products: { anchor: ref("dress.product_id") },
        checks: [eq("reply.action", "cross_sell"), eq("reply.complementary_offer", null),
          eq("state.styling.offers_paused", true)] },
    ], expected: "Pause unsolicited offers while fulfilling a later explicit request for the dress's recorded complementary category.",
    review: ["Prerequisite: the bound dress has a recorded complementary category and eligible matching stock.", "Check that no unsolicited products appear."] },
  { id: "P03", name: "Owned accessories suppress duplicate roles", mode: "live",
    variants: ["I already own a bag and shoes. Find a women's dress for a beach wedding under A$200.",
      "Find a women's beach wedding dress under 200 AUD. I already have shoes and a bag.",
      "Women's beach wedding dress, A$200 maximum. I own both shoes and a bag already."],
    turns: [{ prompt: "I already own a bag and shoes. Find a women's dress for a beach wedding under A$200.",
      needProducts: 1, checks: [
        { path: "state.styling.owned_categories", op: "includes", value: "Bags" },
        { path: "state.styling.owned_categories", op: "includes", value: "Shoes" }] }],
    expected: "Show requested dresses without proposing replacement bags or shoes. Other unowned complementary roles remain eligible.", review: ["Owned pieces must not become new purchases."] },
];
