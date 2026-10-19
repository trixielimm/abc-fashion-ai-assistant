import { z } from "zod";

const QuestionSchema = z.enum(["collection", "direction", "routine", "occasion"]);
export const DiscoveryIntentSchema = z.enum(["start", "everyday", "occasion", "browse", "different"]);
export const DiscoveryStateSchema = z.strictObject({
  stage: z.enum(["collection", "direction", "routine", "occasion", "browsing", "complete"]),
  asked: z.array(QuestionSchema).max(2),
  skipped: z.array(QuestionSchema).max(4),
  seen_product_ids: z.array(z.string().trim().min(1).max(250)).max(64),
  answered: z.array(QuestionSchema).max(4).optional(),
});
export const SuggestedReplySchema = z.strictObject({
  label: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(250),
});
export type DiscoveryState = z.infer<typeof DiscoveryStateSchema>;
export type DiscoveryIntent = z.infer<typeof DiscoveryIntentSchema>;

// Discovery choices are navigation, not implicit product preferences. Only
// quoted customer requirements enter the ordinary validated preference scope.
export function advanceDiscovery(previous: DiscoveryState | null | undefined, intent: DiscoveryIntent, hasItem: boolean, volunteeredRoutine = false): DiscoveryState {
  const state: DiscoveryState = previous ? structuredClone(previous)
    : { stage: "direction", asked: [], skipped: [], seen_product_ids: [] };
  const question = intent === "everyday" ? "routine" : intent === "occasion" ? "occasion" : "direction";
  const answered = intent === "everyday" || intent === "occasion";
  if (volunteeredRoutine) state.answered = [...new Set([...(state.answered ?? []), "routine" as const])];
  if (previous && ["direction", "routine", "occasion"].includes(previous.stage) && !answered) {
    state.skipped = [...new Set([...state.skipped, previous.stage as z.infer<typeof QuestionSchema>])];
  }
  const browse = hasItem || volunteeredRoutine || intent === "browse" || intent === "different" || state.asked.length >= 2 ||
    state.asked.includes(question) || state.skipped.includes(question) ||
    (intent === "start" && Boolean(previous) && previous?.stage !== "collection");
  state.stage = browse ? "browsing" : question;
  if (!browse) state.asked.push(question);
  return DiscoveryStateSchema.parse(state);
}

export function discoveryPresentation(state: DiscoveryState) {
  switch (state.stage) {
    case "direction": return {
      message: "Perfect! Would you like something for everyday wear, something for an occasion, or a few different ideas to react to?",
      suggestions: [
        { label: "Everyday wear", message: "Something for everyday wear." },
        { label: "An occasion", message: "Something for an occasion." },
        { label: "Show me ideas", message: "Show me a few different ideas." },
      ],
    };
    case "routine": return {
      message: "Let's start with your day. More for work, relaxed weekends, or a mix? You can also ask me to show you ideas.",
      suggestions: [
        { label: "Work", message: "Show me ideas for work." },
        { label: "Relaxed weekends", message: "Show me ideas for relaxed weekends." },
        { label: "A mix / show me ideas", message: "Show me a mix of everyday ideas." },
      ],
    };
    case "occasion": return {
      message: "What's the occasion? You can describe it in your own words, or we can start with a few ideas.",
      suggestions: [
        { label: "Wedding guest", message: "Show me ideas for a wedding guest." },
        { label: "Dinner out", message: "Show me ideas for dinner." },
        { label: "Show me ideas first", message: "Show me a few different ideas." },
      ],
    };
    default: return {
      message: "Here are a few different ideas to react to. Nothing needs to be decided yet.",
      suggestions: [
        { label: "None of these / different ideas", message: "None of these. Show me different ideas." },
      ],
    };
  }
}
