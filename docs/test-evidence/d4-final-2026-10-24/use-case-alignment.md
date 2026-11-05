# Final D4 use case alignment — 24 October 2026

Source: supplied final D4 PDF, Figure7 on original page62; descriptions on pages63–72; SRS pages38–53. The companion PDF extract preserves the original printed page numbers.

There are **eight customer use cases**. The descriptions number seven; Browse / Search Products is the eighth, unnumbered diagram function. BR is a testing-report alias only. Table50 captions cart management UC08 but its body says UC07. Tests retain UC07 for cart to avoid changing the supplied body identifiers.

1. BR — Browse / Search Products: TC-BR-01–03, search filter suite, TC-PD-13.
2. UC01 — Shop via Conversation: TC-PE, TC-AI-04, HTTP and controlled service failures; FR01–03,25–29.
3. UC02 — Clarify Shopping Preferences: TC-PV, TC-AIX-01/06, guided discovery and S3/S6; FR03–06,18.
4. UC03 — Obtain Product Recommendations: TC-AI-01–10, TC-INT-03, explanations; FR07–14,27,30,33.
5. UC04 — Receive Complementary Product Recommendations: TC-AIX-02–05/08, combined budgets, cross-sell/upsell; FR21–24. Recommend accessories and Cross-sell and Upsell options are diagram branches of this function, not additional top-level cases.
6. UC05 — View Product Details: TC-PD-01–03/06/07/12, TC-AIX-07, image delivery/fallback; FR11,13,31,33.
7. UC06 — Refine Shopping Preferences: S1/S2/S3-C, CAT/COL/SET, cheaper/state suites; FR15–20,28.
8. UC07 — Manage Shopping Cart: TC-PD-04/05/08–14, TC-UI-02; FR32.

Figure7 separately shows COMP3850 Software Team and Industry Sponsor support functions: maintain/test, requirements feedback, demonstration/handover. These map to quality checks, the coverage review and the client decision; they do not change the customer-case count.

## Scope revisions and limits

- UC05 requires available catalogue-supported details, not multiple colour variants. TC-PD-02 / TC-UI-01 now test accurate single-colour Gold display for P1031. The old variant-switch test is superseded explicitly; no variant support is claimed.
- SRS FR34–40 add authorised catalogue administration. The customer use cases do not establish CRUD/auth compliance. No administration execution is asserted.
- Changing production availability between display/add, client storage failure, a physical Safari/Chrome/Edge device matrix, sustained availability/performance and full security/load certification are not established by this evidence.
- A deployed combined dress+bag request once returned a false occasion conflict. Fresh local/deployed HTTP probes later succeeded; original failure is retained as an intermittent limitation, not silently erased.
- The new BR recovery test found the deployed Browse all products link changed URL without clearing client search state. The local SearchExplorer fix uses its search controller to reset query and results. See original failure and local browser retest. Deployment of this change is not asserted.
- Local candidate source and deployment identity are distinct. Vercel HTTP identifiers and HTML digest do not prove source-commit equality.

Tests were performed by Codex at Salvi’s request; Sarah Thomas remains testing lead and final team reviewer. Peyton’s client acceptance was reported by Salvi, not inferred from test passes.

- TC-AIX-08 value comparison failed on the deployed browser: the phrase was misread as an occasion and products above the saved A$150 cap were displayed. This is DF8 and prevents an all-passing technical readiness claim.
