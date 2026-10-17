import type { CatalogueProduct } from "../recommendations/catalogue";
import { COMMERCE_POLICY } from "../stylist/commerceSchema";
import { relatedLabel } from "./preferenceSearch";

const norm = (value: string | null) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const neutrals = new Set(["black", "white", "ivory", "cream", "beige", "grey", "gray", "navy", "taupe"]);
const paletteFamilies = [["lavender", "lilac", "purple"], ["blue", "navy", "sky blue"], ["pink", "blush", "rose"], ["brown", "tan", "camel", "beige"], ["green", "sage", "olive"]];

// Transparent first-release heuristics, presented as styling suggestions.
// No numerical score is exposed as a calibrated probability or quality claim.
export function scoreCompatibility(candidate: CatalogueProduct, anchors: readonly CatalogueProduct[], purpose: string | null = null) {
  let score = 0;
  const reasons: string[] = [];
  const limitations: string[] = [];
  const occasions = [...new Set([...(purpose ? [purpose] : []), ...anchors.map(anchor => anchor.occasion).filter((value): value is string => Boolean(value))])];
  if (purpose) {
    if (relatedLabel(candidate.occasion, purpose)) { score += 8; reasons.push(`Its recorded occasion matches ${purpose}.`); }
    else { score -= 6; limitations.push(`Its occasion is ${candidate.occasion ?? "not recorded"}; ${purpose} is not confirmed.`); }
  }
  for (const anchor of anchors) {
    const name = anchor.product_name ?? "your selected item";
    if (!purpose && anchor.occasion) {
      if (relatedLabel(candidate.occasion, anchor.occasion)) { score += 6; reasons.push(`It shares the recorded ${anchor.occasion} occasion with ${name}.`); }
      else { score -= 4; limitations.push(`The recorded occasion differs from ${name}.`); }
    }
    if (anchor.style && candidate.style) {
      if (relatedLabel(candidate.style, anchor.style)) { score += 4; reasons.push(`Its ${candidate.style} style coordinates with the recorded style of ${name}.`); }
      else { score -= 1; limitations.push(`Its ${candidate.style} style differs from ${name}'s ${anchor.style} label.`); }
    }
    if (anchor.season && candidate.season) {
      if (relatedLabel(candidate.season, anchor.season) || norm(candidate.season) === "all season" || norm(anchor.season) === "all season") {
        score += 1; reasons.push(`The season labels are compatible with ${name}; this does not verify weather performance.`);
      } else { score -= 2; limitations.push(`Its ${candidate.season} season label differs from ${name}'s ${anchor.season}.`); }
    }
    const colour = norm(candidate.colour), anchorColour = norm(anchor.colour);
    if (colour && anchorColour) {
      if (colour === anchorColour || paletteFamilies.some(family => family.includes(colour) && family.includes(anchorColour))) {
        score += 2; reasons.push(`Styling suggestion: its ${candidate.colour} colour gives a coordinated palette with ${name}.`);
      } else if (neutrals.has(colour)) { score += 1; reasons.push(`Styling suggestion: its ${candidate.colour} colour can act as a neutral alongside ${name}.`); }
    }
  }
  if (!reasons.length) reasons.push("It meets the additional-item filters, but there is little recorded evidence of outfit compatibility.");
  return {
    score,
    evidence: {
      policy_version: COMMERCE_POLICY,
      anchor_ids: anchors.map(anchor => anchor.product_id!).slice(0, 8),
      reasons: [...new Set(reasons)].slice(0, 12), limitations: [...new Set(limitations)].slice(0, 12),
      level: score > 0 && (occasions.length > 0 || anchors.some(anchor => anchor.style)) ? "catalogue_supported" as const : "limited" as const,
    },
  };
}
