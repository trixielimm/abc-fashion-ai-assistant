# D4 testing evidence — 24 October 2026

The revised report covers **eight customer use cases**: the diagram's unnumbered Browse / Search Products function (BR), plus UC01–UC07. Accessory recommendations and cross-sell/upsell are UC04 branches. The source is Figure 7 and the use case descriptions on original D4 pages 62–72.

## Results and limits

- Final offline run: 48/48 scripts passed; typecheck, lint and production webpack build passed.
- Current catalogue/model/HTTP checks: 32/32 latest check IDs passed. Initial setup failures remain under `attempt-1/`.
- Controlled dependency failures/recovery: 3/3 checks passed through the actual POST route in an isolated HTTP process.
- Final full 38-scenario model run: 108 passes and six provider timeouts. Three affected scenarios were then each repeated three times, all nine passing. All attempts are retained in sibling scenario directories; this is not one uninterrupted 114/114 run.
- Deployed browser failures remain: intermittent combined-request occasion conflict (DF6), search recovery (DF7, fixed and verified locally), and value comparison losing the saved maximum budget (DF8). A later passing request does not erase the earlier failure. Local changes are not proven deployed.
- Administrator FR-34–FR-40, physical-browser/device certification, sustained NFR thresholds and several availability/error alternatives lack executed evidence here. An all-passing technical readiness decision is not supported.

## Finding evidence

- `final-d4-srs-and-use-cases.pdf`: extracted requirement-source pages with original printed page numbers.
- `use-case-alignment.md`: eight-case mapping and scope decisions.
- `offline-final.txt`, `quality-checks.json`, `build.txt`, `lint-final.txt`, `typecheck-final.txt`: final local checks.
- `http-model-catalogue-latest.json`: latest result per check ID; raw original attempt and correction are retained.
- `controlled-failures.json`: actual safe 502/503 and restored-service 200 responses.
- `browser-results.jsonl`: observed browser actions; matching PNG/TXT files preserve visible state and exact screenshot dimensions.
- `source-manifest-final.json`, `candidate-changes.patch`, `source/`: exact local candidate identity and source snapshots, excluding environment credentials.
- `report-ui-outcomes.json`: report-ready descriptions grounded in browser records.
- `edit_report.py` and `template-report-v1.4.docx`: editable report generation inputs. The published evidence commit identifies the data used by the report.

Tests were operated and documented by Codex at Salvi's request. Sarah Thomas is the testing lead and final team reviewer. Client acceptance on 21 October was reported by Salvi; no independent review signature or institutional submission is asserted.

GitHub remains private. Give assessors repository access or submit the offline evidence ZIP with the report.
