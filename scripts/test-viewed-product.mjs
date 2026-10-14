import assert from "node:assert/strict";

import {
  readViewedProduct,
  preferencesForViewedProduct,
  chooseCheaperContext,
} from "../lib/stylist/viewedProduct.ts";

import {
  rememberPriceContext,
} from "../lib/stylist/priceContext.ts";

// Synthetic records only. No database or AI requests.
const record = {
  product_id: "PAGE-A",
  product_name: "Synthetic Dress",
  price_aud: 100,
  category: "Clothing",
  subcategory: "Dresses",
  product_type: "Wrap Dress",
  brand_line: "ABC Occasion",
  colour: "Black",
  sizes_available: ["10", "12"],
  is_available: true,
  stock_qty: 4,
};

const product = readViewedProduct(record);
assert.ok(product);

const empty = preferencesForViewedProduct(product, null);

const page = {
  key: 1,
  pathname: "/products/PAGE-A",
  product,
};

let passed = 0;

function check(name, test) {
  test();
  passed++;
  console.log(`PASS: ${name}`);
}

check("The page exposes only the defined public product fields", () => {
  const result = readViewedProduct({
    ...record,
    private_test_field: "omit",
  });

  assert.equal(result.product_id, "PAGE-A");
  assert.equal("private_test_field" in result, false);
  assert.equal("stock_qty" in result, false);
});

check("Missing or malformed catalogue records are not registered", () => {
  assert.equal(readViewedProduct(null), null);

  for (const change of [
    { is_available: false },
    { stock_qty: 0 },
    { stock_qty: 1.5 },
    { price_aud: -1 },
    { sizes_available: [] },
    { sizes_available: [42] },
  ]) {
    assert.equal(
      readViewedProduct({ ...record, ...change }),
      null
    );
  }
});

check("Viewing an item supplies identity, not a guessed size or budget", () => {
  assert.equal(empty.category, "Clothing");
  assert.equal(empty.subcategory, "Dresses");
  assert.equal(empty.product_type, "Wrap Dress");
  assert.equal(empty.size, null);
  assert.equal(empty.max_price, null);
  assert.equal(empty.brand_line, null);
  assert.equal(empty.style, null);
  assert.deepEqual(empty.preferred_colours, []);
});

check("Same-category size and explicit restrictions are retained", () => {
  const saved = {
    ...empty,
    size: "10",
    min_price: 20,
    max_price: 80,
    excluded_colours: ["Brown"],
    material: "Cotton",
    occasion: "Work",
  };

  const before = JSON.stringify(saved);
  const result = preferencesForViewedProduct(product, saved);

  assert.deepEqual(result, saved);
  assert.notStrictEqual(
    result.excluded_colours,
    saved.excluded_colours
  );
  assert.equal(JSON.stringify(saved), before);
});

check("Zero maximum remains a real restriction", () => {
  assert.equal(
    preferencesForViewedProduct(product, {
      ...empty,
      max_price: 0,
    }).max_price,
    0
  );
});

check("Clothing size is not transferred to a viewed shoe", () => {
  const shoe = readViewedProduct({
    ...record,
    product_id: "SHOE",
    category: "Shoes",
    subcategory: "Sneakers",
    product_type: "Sneakers",
    sizes_available: ["7"],
  });

  const saved = {
    ...empty,
    size: "10",
    max_price: 80,
  };

  const result = preferencesForViewedProduct(shoe, saved);

  assert.equal(result.size, null);
  assert.equal(result.category, "Shoes");
  assert.equal(result.max_price, 80);
  assert.equal(saved.size, "10");
});

check("Newly viewed page provides a price reference without a main search", () => {
  const result = chooseCheaperContext(
    null,
    page,
    null,
    null
  );

  assert.equal(result.pageKey, 1);

  assert.deepEqual(result.context.references, [
    {
      product_id: "PAGE-A",
      displayed_price_aud: 100,
    },
  ]);
});

check("After page use, the latest conversational results take priority", () => {
  const latest = rememberPriceContext(
    [{ product_id: "CHEAPER", price_aud: 70 }],
    empty
  );

  const result = chooseCheaperContext(
    latest,
    page,
    1,
    empty
  );

  assert.strictEqual(result.context, latest);
});

check("A new page visit takes priority over an older shortlist", () => {
  const latest = rememberPriceContext([product], empty);

  const nextPage = {
    ...page,
    key: 2,
    product: {
      ...product,
      product_id: "PAGE-B",
      price_aud: 200,
    },
  };

  const result = chooseCheaperContext(
    latest,
    nextPage,
    1,
    empty
  );

  assert.equal(
    result.context.references[0].product_id,
    "PAGE-B"
  );
  assert.equal(result.pageKey, 2);
});

check("Consumed page is not silently reused after an empty result", () => {
  assert.equal(
    chooseCheaperContext(null, page, 1, empty).context,
    null
  );
});

check("Away from a product page the current chat still works", () => {
  const latest = rememberPriceContext([product], empty);

  assert.strictEqual(
    chooseCheaperContext(latest, null, 1, empty).context,
    latest
  );

  assert.equal(
    chooseCheaperContext(null, null, null, null).context,
    null
  );
});

check("Reset clears chat history but a visible page remains a reference", () => {
  const result = chooseCheaperContext(
    null,
    page,
    null,
    null
  );

  assert.equal(
    result.context.preferences.max_price,
    null
  );

  assert.equal(
    result.context.references[0].product_id,
    "PAGE-A"
  );
});

console.log(`\n${passed} viewed-product checks passed.`);