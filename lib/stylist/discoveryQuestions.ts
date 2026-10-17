import type { OutfitChoices } from "./outfitBudgetSchema";

type DiscoveryQuestion = { label: string; question: string; prompt: string };

// Keep the conversational question and its shorter card copy together.
export function outfitDiscoveryQuestions(groups: OutfitChoices["groups"]): DiscoveryQuestion[] {
  return groups.flatMap(group => {
    const preferences = group.preferences;
    const dress = preferences.subcategory === "Dresses";
    const shoes = preferences.category === "Shoes";
    const missingColour = !preferences.preferred_colours.length;
    if (!preferences.product_type) {
      return [{
        label: dress ? "Dress" : group.label,
        question: dress ? `Would you like a particular dress style${missingColour ? " or colour" : ""}?`
          : shoes ? "Do you have a preferred shoe style or heel height?"
            : `Any ${group.label.toLowerCase()} style you'd like to try?`,
        prompt: dress ? `Any style${missingColour ? " or colour" : ""} in mind?`
          : shoes ? "A favourite style or heel height?" : "Any style you'd like to try?",
      }];
    }
    return missingColour ? [{
      label: dress ? "Dress" : group.label,
      question: `Any colours you'd like for ${group.label.toLowerCase()}?`,
      prompt: "Any colours in mind?",
    }] : [];
  });
}
