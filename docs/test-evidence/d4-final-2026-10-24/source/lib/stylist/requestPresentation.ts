import type { Session } from "./conversationProtocol";
import type { ShoppingPreferences } from "../ai/preferenceSchema";
import { formatAud } from "../format-price";

function labels(preferences: Partial<ShoppingPreferences>) {
  return [
    preferences.product_type ?? preferences.subcategory ?? preferences.category,
    preferences.gender && `${preferences.gender}'s collection`,
    preferences.preferred_colours?.length ? `${preferences.preferred_colours.join(" / ")} only` : null,
    preferences.excluded_colours?.length ? `No ${preferences.excluded_colours.join(" / ")}` : null,
    preferences.size && `Size ${preferences.size}`,
    preferences.occasion, preferences.material, preferences.fit, preferences.style, preferences.season, preferences.brand_line,
    preferences.min_price != null ? `From ${formatAud(preferences.min_price)} per item` : null,
    preferences.max_price != null ? `Up to ${formatAud(preferences.max_price)} per item` : null,
  ].filter((label): label is string => Boolean(label));
}

export function shoppingRequestSummary(session: Session) {
  const grouped = session.styling?.outfit_request;
  const purchase = session.styling?.purchase_budget;
  const pending = session.pending?.budget_confirmation;
  const item = labels(session.scopes.item);
  if (grouped) item.unshift(grouped.items.map(component => component.product_type ?? component.subcategory ?? component.category).join(" + "));
  const total = grouped?.total_budget_aud ?? purchase?.limit_aud ?? session.task?.brief.total_budget_aud;
  if (total != null) item.push(`${formatAud(total)} combined budget`);
  if (pending) item.push(`Confirm ${formatAud(pending.total_budget_aud)} combined budget`);
  return { item: [...new Set(item)], shared: labels(session.scopes.shared),
    unverified: [...session.scopes.unresolved_shared, ...session.scopes.unresolved_item] };
}
