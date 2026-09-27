# Recommendation Backend — Initial Test Results

## Scope

Local testing of the single-message recommendation backend.

Endpoint: POST /api/recommendations

Implementation status:
Implemented for the supported preference fields.
Initial local tests passed.
Team review and broader testing remain pending.

The catalogue reader returned 316 visible product records during testing.

## Automated checks

| Check | Observed result |
|---|---|
| Request-schema validation | 10 checks passed |
| API input validation | 6 checks passed |
| Earlier TypeScript check | Passed without reported errors |

The API validation tests covered blank messages, missing messages,
an excessive product limit, unsupported history, malformed JSON
and an incorrect content type.

These checks do not constitute a complete security assessment.

## Live recommendation scenarios

| Scenario | Observed result |
|---|---|
| Lavender clothing, size 10, maximum $100 per item | Three exact matches at $55, $75 and $100 |
| Same preferences, maximum $75 | Two exact matches; the $100 product was excluded |
| Same preferences, maximum $50 | Alternatives returned within budget, with Lavender identified as unmatched |
| Maximum $50 with Brown excluded | Brown Linen Shirt excluded; four non-Brown alternatives returned |
| Size 12, maximum $50, no colour exclusion | All returned products listed size 12; Brown Linen Shirt was absent |
| Clothing, Lavender, Beach Wedding, Relaxed, size 10, maximum $100 | P1002 returned with four of four soft preferences matched |
| Size 10, maximum $1 | Filter check found zero eligible products; recommendation API returned no_match and an empty product list |

These results were reviewed from local API responses.
They are not evidence of complete catalogue coverage or independent
real-world styling quality.

## Current implementation limits

- Each request is independent. Conversation memory is not implemented.
- Budgets apply per product, not to a complete outfit.
- Matching uses catalogue labels rather than semantic similarity.
- Category is currently a soft preference.
- Strict instructions such as "only this category" need further support.
- Category-specific sizing and size conversions are not implemented.
- Full validation against catalogue values remains incomplete.
- Populated extraction fields outside the eight supported fields
  currently stop recommendations rather than being silently ignored.
- Website chat integration has not been completed through this work.
- Cross-sell, upsell and coordinated outfit logic are not implemented
  in this endpoint.
- The recommendation endpoint is restricted to development mode.

## Further verification required

- Independently verify how the live catalogue view derives per-size stock.
- Test unavailable and zero-stock records.
- Test conflicting preferences and unsupported extracted fields.
- Test AI-service and database failures.
- Review broader recommendation quality and catalogue coverage.
- Review access controls, usage limits and deployment configuration.

## Checks before team review

- Final TypeScript check: Passed.
- ESLint check: Passed; no errors or warnings reported.
- Production build: Passed.
- .env.local tracking check: Not tracked and ignored by the .env* rule.
- Staged file/content review: Reviewed locally before commit.
- Team code review: Pending.