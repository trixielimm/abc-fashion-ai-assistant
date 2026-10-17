type Product = {
  product_id: string;
  product_name: string;
  price_aud: number;
  category: string | null;
  colour: string | null;
  sizes_available: readonly string[];
  product_type?: string | null;
};

type Input = {
  status: string;
  action: string;
  baseMessage: string;
  products: readonly Product[];
  alternatives: readonly (Product & { differences: readonly string[] })[];
  preferences: {
    min_price: number | null;
    max_price: number | null;
    size: string | null;
  } | null;
  references: readonly {
    product_name: string | null;
    price_aud: number | null;
  }[];
  alternativeKind: string | null;
  canPreviewOtherColours: boolean;
  unresolved: readonly string[];
  hasOptionalQuestion: boolean;
};

const money = (value: number) => `A$${value.toFixed(2)}`;
const normalise = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();
const paragraphs = (...parts: string[]) => parts.filter(Boolean).join("\n\n");

function selectionDetails(products: readonly Product[], input: Input): string {
  if (products.length === 0) return "";
  const prices = products.map(product => product.price_aud);
  if (prices.some(price => !Number.isFinite(price) || price < 0)) return "";

  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const sentences: string[] = [];

  if (products.length > 1) {
    sentences.push(low === high
      ? `Each of these options is ${money(low)}.`
      : `These options range from ${money(low)} to ${money(high)}.`);
  }

  const kinds = [...new Set(products.map(product => product.product_type?.trim()).filter((value): value is string => Boolean(value)))];
  if (kinds.length > 1) {
    const shown = kinds.slice(0, 3).map(value => value.toLowerCase());
    const listed = shown.length === 2
      ? shown.join(" and ")
      : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
    sentences.push(`The selection includes ${listed} options.`);
  }

  const maximum = input.preferences?.max_price;
  if (typeof maximum === "number" && Number.isFinite(maximum) && high <= maximum) {
    sentences.push(`I've kept this selection within your ${money(maximum)} per-item limit.`);
  }

  const requestedSize = input.preferences?.size;
  if (requestedSize && products.every(product =>
    product.sizes_available.some(size => normalise(size) === normalise(requestedSize))
  )) {
    sentences.push(`Your requested size, ${requestedSize}, is listed for ${products.length === 1 ? "this item" : "each item"}.`);
  }

  return sentences.join(" ");
}

function optionLabel(products: readonly Product[]): string {
  const categories = new Set(products.map(product => product.category));
  const labels: Record<string, string> = {
    Clothing: "clothing options",
    Bags: "bag options",
    Shoes: "shoe options",
    Accessories: "accessory options",
  };
  const category = categories.size === 1 ? products[0]?.category : null;
  const kind = category ? labels[category] ?? "options" : "options";
  const colours = [...new Set(products.map(product => product.colour?.trim() || ""))];
  const colour = colours.length === 1 && colours[0] ? `${colours[0].toLowerCase()} ` : "";
  return colour + kind;
}

export function friendlyShoppingMessage(input: Input): string {
  const { products, alternatives, references, status, action } = input;
  const ending = input.hasOptionalQuestion
    ? "Have a look at the options below and see what catches your eye."
    : 'Have a look below. You can keep browsing, or tell me something like "cheaper" or "a different colour" to refine the selection.';

  if (status === "needs_clarification") {
    if (input.unresolved.length === 0) return input.baseMessage;
    return paragraphs(
      `I can help you explore options, but I can't verify or apply this part of your request with the product information I have: ${input.unresolved.join("; ")}.`,
      "I haven't treated that as a match or removed it from your request. Tell me which part, if any, you're happy to change before I search again."
    );
  }

  if (status === "matches" && products.length > 0) {
    let opening = products.length === 1
      ? `I found ${products[0].product_name} for ${money(products[0].price_aud)}.`
      : `I've found ${products.length} ${optionLabel(products)} for you to explore.`;

    if (action === "cross_sell" && references.length === 1 && references[0].product_name) {
      opening = products.length === 1
        ? `To go with ${references[0].product_name}, here's one option to consider: ${products[0].product_name} at ${money(products[0].price_aud)}.`
        : `To go with ${references[0].product_name}, I've found ${products.length} ${optionLabel(products)} for you to consider.`;
    }

    if (action === "cheaper" && references.length > 0) {
      const prices = references.map(product => product.price_aud);
      if (prices.every((price): price is number => typeof price === "number" && Number.isFinite(price))) {
        const ceiling = Math.min(...prices);
        if (products.every(product => product.price_aud < ceiling)) {
          opening = products.length === 1
            ? `Here's a lower-priced option: ${products[0].product_name} at ${money(products[0].price_aud)}.`
            : `I've found ${products.length} lower-priced options for you.`;
          opening += references.length === 1
            ? ` ${products.length === 1 ? "It costs" : "They each cost"} less than the ${money(ceiling)} reference item.`
            : ` ${products.length === 1 ? "It is" : "Each is"} below ${money(ceiling)}, the lowest price in your previous selection.`;
        }
      }
    }

    if (action === "upsell") {
      opening = products.length === 1
        ? "I've found a replacement to compare because it adds a demonstrated benefit for your request."
        : `I've found ${products.length} replacements with demonstrated benefits to compare.`;
    }

    const explanation = action === "upsell"
      ? "Each card explains the benefit, price difference and trade-offs. A higher price alone doesn't establish better quality, and choosing an alternative won't automatically remove the original from your cart."
      : "";

    const otherOptions = alternatives.length
      ? "I've also included alternatives separately below. Some requested details differ or can't be verified; the cards explain those differences."
      : "";

    return paragraphs(opening, selectionDetails(products, input), explanation, otherOptions, ending);
  }

  if (status === "alternatives" && alternatives.length > 0) {
    const colourPreview = input.alternativeKind === "colour_preview";
    const opening = colourPreview
      ? "I've found some other colours for you to explore, as requested. These are alternatives to your original colour choice, not exact matches."
      : "I haven't found an exact match for all the details you mentioned, but there are some alternatives you can consider.";
    const details = alternatives.some(product => product.differences.some(value => /not recorded|cannot verify/i.test(value)))
      ? "Some requested details aren't recorded in the product information, so I can't confirm them. I've marked what differs or is unverified on each card."
      : "I've kept the differences visible on each card so you can decide whether any of these would work for you.";
    return paragraphs(opening, details, selectionDetails(alternatives, input),
      "Your original request is still saved. Exploring these options doesn't change it or add anything to your cart.");
  }

  if (status === "no_match") {
    // Preserve the actual no-match reason rather than inventing missing stock.
    return paragraphs(input.baseMessage, input.canPreviewOtherColours
      ? 'One way to broaden the search is to use "Explore other colours" below. That preview keeps your other restrictions and leaves your original colour request saved.'
      : "You can tell me which detail you're happy to change, and I'll use that in the next search. I haven't changed the request for you.");
  }

  if (status === "no_upsell") {
    return paragraphs(
      input.baseMessage,
      "You can stay with the current choice. What would you value in a replacement: adjustability, pockets, lining or easier care? I'll compare only recorded evidence and keep your budget."
    );
  }

  if (status === "no_rule" || status === "rule_unavailable") {
    return paragraphs(
      input.baseMessage,
      "We can still explore the additional item as a separate search. Tell me what you'd like to look for, and I'll use the restrictions you've asked me to keep for every item."
    );
  }

  return input.baseMessage;
}
