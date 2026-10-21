// Keep the vocabulary for explicit rules consistent across grounding/validation.
export function hasSharedScope(message: string) {
  return /\b(?:shared|global(?:ly)?|all (?:items|recommendations|(?:future )?searches)|every (?:item|recommendation|search)|throughout|for everything)\b/i.test(message);
}

export function permitsBudgetRemoval(message: string) {
  return /\b(?:no (?:price |budget |spending )?(?:limit|cap)|any price|(?:remove|clear|drop|forget)\s+(?:(?:my|the|saved|current|shared)\s+)*(?:(?:price|budget|spending)\s+)?(?:limit|cap|budget)|without (?:a |the )?(?:price limit|budget|spending cap))\b/i.test(message) &&
    !/\b(?:don't|don’t|do not|never|not)\s+(?:remove|clear|drop|forget)\b/i.test(message);
}
