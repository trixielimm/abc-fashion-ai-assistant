# D4 testing report — version 1.5, 24 October 2026

This revision maps all eight customer use cases from the final D4 diagram: Browse/Search Products and UC01–UC07. The source descriptions retain UC07 for cart; the inconsistent UC08 table caption is disclosed.

The Word and PDF contain identical testing content. The ZIP contains the report and offline evidence for assessors without private-repository access.

Results: 48/48 offline scripts, 32/32 latest catalogue/model/HTTP checks and 3/3 isolated failure/recovery checks passed. All 38 real-model scenarios have three latest passing repetitions after provider-timeout reruns; all attempts are retained.

Deployed failures remain recorded: intermittent occasion conflict (DF6), search reset (DF7, fixed locally) and value comparison losing the saved maximum budget (DF8). The report does not assert an all-passing technical readiness decision. Other SRS/platform coverage limits and Sarah Thomas's review responsibility are explicit.

The report's evidence links use the fixed publication commit 996c1c8. GitHub remains private; no access permissions or production deployment were changed.
