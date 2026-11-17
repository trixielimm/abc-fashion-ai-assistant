// Keep the literal suppression rule shared by interpretation and presentation.
export function explicitNoExtras(message: string) {
  const qualified = message.match(/\b(?:i )?only (?:need|want)\s+[^.!?]{0,80}\b(?:dress(?:es)?|shoes|bags?|necklaces?)\b/i);
  if (qualified && !/\bnot\s*$/i.test(message.slice(0, qualified.index))) return qualified;
  const match = message.match(/\b(?:no (?:more |other |extra )?(?:extras|items|products|recommendations|accessories)|(?:don't|don’t|do not) want (?:any )?extras|no extra recommendations(?: after [^.]+)?|(?:i )?only (?:need|want) (?:a |an |the )?(?:dress|shoes|bag|necklace)|(?:only|just) (?:a |an |the )?(?:dress|shoes|bag|necklace)(?=\s*[,.;!?]|\s*$|\s+(?:for|under|in|please))|(?:a |an |the )?(?:dress|shoes|bag|necklace) only)\b/i);
  return match && !/\b(?:not|isn't|isn’t)\s*$/i.test(message.slice(0, match.index)) ? match : null;
}

// Generic ownership has no SKU or descriptive attributes to invent.
export function ownedAccessoryStatement(message: string) {
  const quote = message.match(/\bi (?:already )?(?:own|have) (?:both )?(?:(?:a|an|some|the|my) )?(?:bags?|shoes?)(?:\s*(?:and|,)\s*(?:(?:a|an|some|the|my) )?(?:bags?|shoes?))*(?: already)?(?=\s*(?:[.!?]|$))/i)?.[0];
  return quote ? { quote, categories: [
    ...(/\bbags?\b/i.test(quote) ? ["Bags" as const] : []),
    ...(/\bshoes?\b/i.test(quote) ? ["Shoes" as const] : []),
  ] } : null;
}
