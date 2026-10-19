import { newSession } from "../../lib/stylist/conversationProtocol.ts";

// Product/search suites start after the shopper has chosen unrestricted browsing.
// Fresh-session collection onboarding is exercised by test-collection-first.mjs.
export function allCollectionSession() {
  return { ...newSession(), collection: { choice: "All", checkpoint: null } };
}
