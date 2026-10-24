// Read explicit size edits only. Catalogue validation still decides whether a
// stated label exists; ordinary words after "size" are never invented labels.
export function explicitSizeEdit(message: string): { value: string | null; evidence: string } | null {
  const edits: { index: number; value: string | null; evidence: string }[] = [];
  const negated = (index: number) => /\b(?:don't|don’t|do not|never|not)\s+(?:(?:set|change|use|remove|drop|clear|forget)\s+)?$/i.test(message.slice(0, index));
  for (const match of message.matchAll(/\b(?:no size(?:\s+(?:filter|restriction|requirement))?|without (?:a |the |any )?size(?:\s+(?:filter|restriction|requirement))?|any size|all sizes)\b/gi)) {
    // "No size 12" negates a particular label; it is not permission to clear
    // every size restriction. A bare "no size" must finish its clause.
    if (/^no size$/i.test(match[0]) && !/^\s*(?:[.!?;,]|$)/.test(message.slice(match.index + match[0].length))) continue;
    if (!negated(match.index)) edits.push({ index: match.index, value: null, evidence: match[0] });
  }
  const labels = "(?:AU\\s*)?(?:\\d+(?:[./-]\\d+)*|[2-9]?X{0,3}[SML]|(?:extra[- ]?)?(?:small|medium|large))";
  for (const match of message.matchAll(new RegExp(`\\bsize\\s+(?:(?:to|is|of)\\s+)?(${labels})\\b`, "gi"))) {
    const prefix = message.slice(0, match.index);
    const removal = prefix.match(/\b(?:drop|remove|clear|forget)\b(?:(?!\b(?:show|find|keep|set|change|use|want|need)\b)[^.!?;]){0,90}$/i);
    if (removal && !negated(removal.index!)) {
      edits.push({ index: match.index, value: null, evidence: message.slice(removal.index, match.index + match[0].length) });
    } else if (!negated(match.index) && !/\b(?:no|without|not)\s*$/i.test(prefix)) {
      edits.push({ index: match.index, value: match[1], evidence: match[0] });
    }
  }
  for (const match of message.matchAll(/\b(?:drop|remove|clear|forget)\s+(?:(?:my|the|current|existing)\s+)?size(?:\s+(?:filter|restriction|requirement))?\b/gi)) {
    if (!negated(match.index)) edits.push({ index: match.index, value: null, evidence: match[0] });
  }
  const last = edits.sort((a, b) => a.index - b.index).at(-1);
  return last ? { value: last.value, evidence: last.evidence } : null;
}
