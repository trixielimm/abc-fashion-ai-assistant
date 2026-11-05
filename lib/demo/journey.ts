import type { Session } from "../stylist/conversationProtocol";

export type DemoOccasion = "beach" | "work";
export type DemoRefinement = "budget" | "colour" | "size";
export type DemoFollowUp = "bag" | "cheaper" | "compare" | "material";
export type DemoProgress = {
  occasion: DemoOccasion | null;
  refinement: DemoRefinement | null;
  followUp: DemoFollowUp | null;
};
export type DemoChoice = { id: string; label: string; message: string; aliases: string[] };

export const newDemoProgress = (): DemoProgress => ({ occasion: null, refinement: null, followUp: null });
export const occasionChoices: DemoChoice[] = [
  { id: "beach", label: "Beach wedding", message: "Find me a dress for a beach wedding under A$200.",
    aliases: ["Beach wedding", "I need a dress for a beach wedding under $200."] },
  { id: "work", label: "Work dinner", message: "Find me a dress for a work dinner under A$200.",
    aliases: ["Work dinner", "I need a dress for a work dinner under $200."] },
];
export const refinementChoices: DemoChoice[] = [
  { id: "budget", label: "Budget: A$150", message: "Reduce the budget to A$150, keeping the same occasion.",
    aliases: ["Reduce the budget to $150.", "Under $150 please.", "Make it cheaper, under $150."] },
  { id: "colour", label: "Colour: lavender", message: "Show me lavender options, keeping my occasion and budget.",
    aliases: ["Show me lavender options.", "Make it lavender.", "Lavender please."] },
  { id: "size", label: "Size: 10", message: "Only show size 10, keeping my occasion and budget.",
    aliases: ["Only show size 10.", "Size 10 please.", "I need size 10."] },
];
export const followUpChoices: DemoChoice[] = [
  { id: "bag", label: "Find a matching bag", message: "Find a matching bag for the second dress under A$80.",
    aliases: ["Find a matching bag for the second dress under $80.", "Match a bag to the second dress under $80."] },
  { id: "cheaper", label: "Find a cheaper dress", message: "Find something cheaper than the second dress.",
    aliases: ["Find a cheaper alternative to the second dress.", "Show me a cheaper option than the second dress."] },
  { id: "compare", label: "Compare the first two", message: "Compare the first two dresses.",
    aliases: ["Compare the first two.", "What is the difference between the first two dresses?"] },
  { id: "material", label: "Ask about the fabric", message: "What material is the second dress made from?",
    aliases: ["What fabric is the second dress?", "What is the second dress made of?"] },
];

export function demoRound(progress: DemoProgress) {
  return !progress.occasion ? 1 : !progress.refinement ? 2 : !progress.followUp ? 3 : 4;
}
export function demoChoices(progress: DemoProgress): DemoChoice[] {
  return [occasionChoices, refinementChoices, followUpChoices][demoRound(progress) - 1] ?? [];
}
export function normaliseDemoMessage(message: string) {
  return message.toLowerCase().replace(/a\$|aud\s*/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
export function matchDemoChoice(message: string, progress: DemoProgress) {
  const text = normaliseDemoMessage(message);
  return demoChoices(progress).find((choice, index) => [choice.message, ...choice.aliases, String(index + 1)]
    .some(alias => normaliseDemoMessage(alias) === text));
}
export function demoRouteNumber(progress: DemoProgress) {
  if (!progress.occasion || !progress.refinement || !progress.followUp) return null;
  return occasionChoices.findIndex(choice => choice.id === progress.occasion) * 12 +
    refinementChoices.findIndex(choice => choice.id === progress.refinement) * 4 +
    followUpChoices.findIndex(choice => choice.id === progress.followUp) + 1;
}
export function canUseAudienceChoice(progress: DemoProgress, session: Session) {
  return demoRound(progress) < 3 || session.context.latest.filter(product => product.subcategory === "Dresses").length >= 2;
}

export const demoRoutes = occasionChoices.flatMap(occasion => refinementChoices.flatMap(refinement =>
  followUpChoices.map(followUp => ({ occasion, refinement, followUp }))));
