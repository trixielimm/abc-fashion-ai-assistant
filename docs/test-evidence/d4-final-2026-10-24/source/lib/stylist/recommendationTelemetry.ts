"use client";
import { COMMERCE_POLICY, RecommendationEventSchema } from "./commerceSchema";
import type { z } from "zod";

let sessionId: string | null = null;
export function trackRecommendationEvents(recommendationId: string, items: Array<{
  product_id: string; position: number; event_type: z.infer<typeof RecommendationEventSchema>["event_type"];
}>, placement?: "primary" | "complementary") {
  if (!items.length) return;
  sessionId ??= crypto.randomUUID();
  const events = items.map(item => RecommendationEventSchema.parse({
    ...item, event_id: crypto.randomUUID(), session_id: sessionId,
    recommendation_id: recommendationId, policy_version: COMMERCE_POLICY,
    ...(placement ? { placement } : {}),
  }));
  // Telemetry is optional and must never block shopping or mutate the cart.
  void fetch("/api/stylist-events", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }), keepalive: true,
  }).catch(() => {});
}
