# Matching pieces with a combined budget

The request “can you find me bottoms to match the jacket, or some shirt as well, total budget is 500 aud” now searches for both bottoms and shirts with one A$500 limit. “Or … as well” is treated as additive; genuine either/or wording can still require clarification.

The jacket is resolved from the product context or conversation and retained as a styling reference. Its price is excluded from the budget for the new pieces. If several jackets are possible, the stylist asks which jacket while preserving the requested components and total. Budget-only refinements retain those components and the jacket reference.

The existing combined-budget solver supplies separate Bottoms and Shirts groups. Every displayed choice of one item per group fits the total. Catalogue attributes provide pairing evidence, and generic shirts cannot silently become unrelated tops. Other colours, sizes and requirements continue through the full interpreter.

## Verification

- All 39 regression scripts passed: [regression evidence](test-evidence/regression-2026-10-19T02-41-48-967Z.txt). The new matching-set script covers 14 cases, including over-budget combinations, ambiguous references, genuine either/or requests and retained constraints.
- Three live customer scenarios passed, including budget refinements: [scenario evidence](test-evidence/customer-scenarios-2026-10-19T02-40-03-570Z/summary.json).
- ESLint and the Webpack production build passed.
- In the browser, the exact reported prompt produced both groups under A$500. Saving Pink Straight Jeans (A$85) and Red Linen Shirt (A$180) showed two items, A$265 for new pieces and A$235 remaining. No cart action was taken.
- [Browser screenshot](test-evidence/matching-set-total-budget-2026-10-19.png).
