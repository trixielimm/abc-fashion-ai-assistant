type Candidate = {
  kind: "size" | "like" | "avoid" | "note";
  facet: "fit" | null;
  value: string;
  item_scope: string | null;
  item_type: "dress" | "shoes" | null;
  size_system: string | null;
};

/** Reliable candidates for the most common profile statements. A model handles wider phrasing. */
export function commonStyleMemory(message: string): Candidate | null {
  const text = message.trim();
  const dislikedSkinny = /\b(?:i\s+)?(?:do\s+not|don['’]?t|dont|dislike|hate)\s+(?:like\s+)?skinny\s+jeans\b/i.test(text);
  if (dislikedSkinny) {
    return { kind: "avoid", facet: "fit", value: "Skinny", item_scope: "Jeans", item_type: null, size_system: null };
  }
  const likedSkinny = /\bi\s+(?:like|love|prefer)\s+skinny\s+jeans\b/i.test(text);
  if (likedSkinny) {
    return { kind: "like", facet: "fit", value: "Skinny", item_scope: "Jeans", item_type: null, size_system: null };
  }
  const size = text.match(/\b(?:my\s+)?(dress|shoe|shoes)\s+size\s+(?:is\s+)?(AU|UK|EU|US)\s*([A-Za-z0-9.]+)\b/i)
    ?? text.match(/\bi\s+wear\s+(AU|UK|EU|US)\s*([A-Za-z0-9.]+)\s+(dress|shoe|shoes)\s*(?:size)?\b/i);
  if (size) {
    const firstIsType = /^(dress|shoe)/i.test(size[1]);
    const itemType = firstIsType ? size[1] : size[3];
    return {
      kind: "size", facet: null, value: firstIsType ? size[3] : size[2],
      item_scope: null, item_type: itemType.toLowerCase() === "dress" ? "dress" : "shoes",
      size_system: (firstIsType ? size[2] : size[1]).toUpperCase(),
    };
  }
  return null;
}
