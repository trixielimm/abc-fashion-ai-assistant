import { z } from "zod";
import { issue, type ConversationIssue } from "./conversationIssues";

import {
  ShoppingPreferencesSchema,
  type ShoppingPreferences,
} from "../ai/preferenceSchema";

// Product identity and size cannot be universal cross-category preferences.
const SharedPreferencesSchema = ShoppingPreferencesSchema.omit({
  category: true,
  subcategory: true,
  product_type: true,
  size: true,
}).strict();

const unresolved = z
  .array(z.string().trim().min(1))
  .max(12);

export const PreferenceScopesSchema = z.strictObject({
  item: ShoppingPreferencesSchema,
  shared: SharedPreferencesSchema,
  unresolved_item: unresolved,
  unresolved_shared: unresolved,
});

export type PreferenceScopes =
  z.infer<typeof PreferenceScopesSchema>;

type Composition =
  | {
      status: "ready";
      preferences: ShoppingPreferences;
    }
  | {
      status: "needs_clarification";
      message: string;
      fields: string[];
      issues: ConversationIssue[];
    };

export function emptyShoppingPreferences(): ShoppingPreferences {
  return ShoppingPreferencesSchema.parse({
    gender: null,
    category: null,
    subcategory: null,
    product_type: null,
    occasion: null,
    style: null,
    preferred_colours: [],
    excluded_colours: [],
    season: null,
    material: null,
    fit: null,
    size: null,
    min_price: null,
    max_price: null,
    brand_line: null,
  });
}

export function createPreferenceScopes(): PreferenceScopes {
  const item = emptyShoppingPreferences();

  const shared = SharedPreferencesSchema.parse({
    gender: item.gender,
    occasion: item.occasion,
    style: item.style,
    preferred_colours: [],
    excluded_colours: [],
    season: item.season,
    material: item.material,
    fit: item.fit,
    min_price: item.min_price,
    max_price: item.max_price,
    brand_line: item.brand_line,
  });

  return {
    item,
    shared,
    unresolved_item: [],
    unresolved_shared: [],
  };
}

const normalise = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

function uniqueLabels(values: readonly string[]): string[] {
  return [
    ...new Map(
      values.map((value) => [
        normalise(value),
        value.trim(),
      ])
    ).values(),
  ];
}

export function composePreferences(input: unknown, options: { allowUnverified?: boolean } = {}): Composition {
  const state = PreferenceScopesSchema.parse(input);
  const preferences = ShoppingPreferencesSchema.parse(state.item);
  const shared = state.shared;
  const conflicts: string[] = [];

  const unsupported = [
    ...state.unresolved_shared,
    ...state.unresolved_item,
  ];

  if (unsupported.length > 0 && !options.allowUnverified) {
    return {
      status: "needs_clarification",
      message:
        `These requirements cannot yet be applied safely: ${unsupported.join("; ")}. They have not been dropped.`,
      fields: ["unresolved_requirements"],
      issues: [
        ...state.unresolved_item.map(value => issue("unverified_requirement", "requirement", "item", value)),
        ...state.unresolved_shared.map(value => issue("unverified_requirement", "requirement", "shared", value)),
      ],
    };
  }

  const textFields = [
    "gender",
    "occasion",
    "style",
    "season",
    "material",
    "fit",
    "brand_line",
  ] as const;

  for (const field of textFields) {
    const globalValue = shared[field];
    const itemValue = preferences[field];

    if (globalValue === null) continue;

    if (
      itemValue !== null &&
      normalise(itemValue) !== normalise(globalValue)
    ) {
      conflicts.push(field);
    } else {
      Object.assign(preferences, {
        [field]: globalValue,
      });
    }
  }

  const floors = [
    shared.min_price,
    preferences.min_price,
  ].filter((value): value is number => value !== null);

  const ceilings = [
    shared.max_price,
    preferences.max_price,
  ].filter((value): value is number => value !== null);

  preferences.min_price = floors.length
    ? Math.max(...floors)
    : null;

  preferences.max_price = ceilings.length
    ? Math.min(...ceilings)
    : null;

  if (
    preferences.min_price !== null &&
    preferences.max_price !== null &&
    preferences.min_price > preferences.max_price
  ) {
    conflicts.push("price_range");
  }

  const itemColours = uniqueLabels(
    preferences.preferred_colours
  );

  const sharedColours = uniqueLabels(
    shared.preferred_colours
  );

  if (itemColours.length > 0 && sharedColours.length > 0) {
    const allowed = new Set(
      sharedColours.map(normalise)
    );

    preferences.preferred_colours = itemColours.filter(
      (value) => allowed.has(normalise(value))
    );

    if (preferences.preferred_colours.length === 0) {
      conflicts.push("preferred_colours");
    }
  } else {
    preferences.preferred_colours =
      itemColours.length > 0
        ? itemColours
        : sharedColours;
  }

  preferences.excluded_colours = uniqueLabels([
    ...shared.excluded_colours,
    ...preferences.excluded_colours,
  ]);

  const excluded = new Set(
    preferences.excluded_colours.map(normalise)
  );

  if (
    preferences.preferred_colours.some(
      (value) => excluded.has(normalise(value))
    )
  ) {
    conflicts.push("colour_exclusions");
  }

  return conflicts.length > 0
    ? {
        status: "needs_clarification",
        message:
          `The item request conflicts with saved shared restrictions: ${conflicts.join(", ")}. Please clarify which restriction to change.`,
        fields: conflicts,
        issues: conflicts.map(field => issue("shared_conflict", field, "shared",
          field in state.item ? state.item[field as keyof ShoppingPreferences] : null,
          field in shared ? shared[field as keyof typeof shared] : null)),
      }
    : {
        status: "ready",
        preferences,
      };
}

// A new additional-item request replaces item-specific preferences only.
// The caller must establish scope from the conversation before using this.
export function startAdditionalItem(
  previous: unknown,
  requested: ShoppingPreferences,
  unresolvedItem: string[] = []
): PreferenceScopes {
  const state = PreferenceScopesSchema.parse(previous);

  return PreferenceScopesSchema.parse({
    ...state,
    item: ShoppingPreferencesSchema.parse(requested),
    unresolved_item: unresolvedItem,
  });
}
