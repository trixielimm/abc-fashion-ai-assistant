import { z } from "zod";

import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "./preferenceSchema";

import type { CataloguePreferenceValues } from "../catalogue/preferenceValues";

export const FollowUpKindSchema = z.enum([
  "lower_budget",
  "different_colour",
  "different_style",
]);

export type FollowUpKind = z.infer<typeof FollowUpKindSchema>;

export type FollowUpResult = {
  preferences: ShoppingPreferences;
  question: {
    kind: FollowUpKind;
    message: string;
  } | null;
};

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function requestedFollowUp(message: string): FollowUpKind | null {
  const text = normalise(message)
    .replace(/[.!?]+$/, "")
    .replace(/^please\s+/, "")
    .replace(/(?:,?\s+please)$/, "");

  // Match whole requests, not a word inside a different instruction.
  if (
    /^(?:can you )?(?:show me )?(?:something )?(?:cheaper|less expensive|more affordable)$/.test(text)
  ) {
    return "lower_budget";
  }

  if (
    /^(?:can you )?(?:show me )?(?:something in )?(?:a )?(?:different|another) colou?r$/.test(text)
  ) {
    return "different_colour";
  }

  if (
    /^(?:can you )?(?:show me )?(?:something )?(?:more casual|less formal)$/.test(text)
  ) {
    return "different_style";
  }

  return null;
}

export function resolveFollowUp(
  message: string,
  current: ShoppingPreferences | undefined,
  catalogue: CataloguePreferenceValues,
  pending?: FollowUpKind
): FollowUpResult | null {
  const requested = requestedFollowUp(message);
  const kind = requested ?? pending;

  // Other messages continue through the existing OpenAI extractor.
  if (!current || !kind) return null;

  const questionKind: FollowUpKind = kind;

  // Validate and copy the saved preferences before changing anything.
  const preferences = ShoppingPreferencesSchema.parse(current);
  const answer = normalise(message);

  if (["cancel", "never mind", "nevermind"].includes(answer)) {
    return { preferences, question: null };
  }

  function ask(text: string): FollowUpResult {
    return {
      preferences,
      question: {
        kind: questionKind,
        message:
          `${text} Type cancel to keep the current preferences, ` +
          "or use Reset to start again.",
      },
    };
  }

  if (kind === "lower_budget") {
    function budgetQuestion(): string {
      const minimum = preferences.min_price;
      const maximum = preferences.max_price;

      if (maximum !== null && maximum <= (minimum ?? 0)) {
        return (
          "There is no lower maximum within the current price range. " +
          "Cancel or reset before changing the range."
        );
      }

      return (
        "What maximum price per item should I use? " +
        "Reply with an amount such as $50." +
        (maximum !== null
          ? ` Choose less than $${maximum.toFixed(2)}.`
          : "") +
        (minimum !== null
          ? ` Keep it at least $${minimum.toFixed(2)}.`
          : "")
      );
    }

    // The customer requested cheaper products but gave no new amount.
    if (requested) return ask(budgetQuestion());

    // Accept a complete amount, not an arbitrary number inside a sentence.
    const match = message.trim().match(
      /^(?:(?:AUD|AU\$|\$)\s*)?(\d+(?:\.\d{1,2})?)(?:\s*(?:AUD|dollars?))?$/i
    );

    const amount = match ? Number(match[1]) : Number.NaN;

    if (
      !Number.isFinite(amount) ||
      !Number.isSafeInteger(Math.round(amount * 100)) ||
      (preferences.max_price !== null &&
        amount >= preferences.max_price) ||
      (preferences.min_price !== null &&
        amount < preferences.min_price)
    ) {
      return ask(budgetQuestion());
    }

    preferences.max_price = amount;
    return { preferences, question: null };
  }

  const isColour = kind === "different_colour";

  const labels = [
    ...new Set(
      catalogue.rows
        .map((row) => (isColour ? row.colour : row.style))
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
        .map((value) => value.trim())
    ),
  ].sort((a, b) => a.localeCompare(b));

  const excluded = preferences.excluded_colours.map(normalise);

  const previous = isColour
    ? preferences.preferred_colours.map(normalise)
    : preferences.style
      ? [normalise(preferences.style)]
      : [];

  const choices = labels.filter(
    (label) =>
      !previous.includes(normalise(label)) &&
      (!isColour || !excluded.includes(normalise(label)))
  );

  function labelQuestion(): string {
    const field = isColour ? "colour" : "style";

    if (choices.length === 0) {
      return (
        `No other ${field} labels are available under these label rules. ` +
        "Cancel or reset to change the request."
      );
    }

    const examples = choices.slice(0, 6).join(", ");

    return isColour
      ? `Which colour would you prefer? Reply with one catalogue colour, for example: ${examples}.`
      : `Which catalogue style should I use? Available labels include: ${examples}. I will not assume that one label is more casual than another.`;
  }

  if (requested) return ask(labelQuestion());

  const choice = choices.find(
    (label) => normalise(label) === answer
  );

  if (!choice) return ask(labelQuestion());

  if (isColour) {
    preferences.preferred_colours = [choice];
  } else {
    preferences.style = choice;
  }

  return { preferences, question: null };
}