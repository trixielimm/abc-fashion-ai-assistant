# AI Stylist: presentation overview

```mermaid
flowchart TD
    U["User prompt"] --> D{"Understand request<br/>and check catalogue"}
    D -->|"Need more detail"| C["Clarification"]
    D -->|"Matching products"| R["Recommendation"]
    R -.->|"Matching extras available"| O["Optional offer"]
    D -->|"Close options available"| A["Alternatives"]
    D -->|"Product question"| Q["Answer / comparison"]
    D -->|"Nothing suitable"| N["No match"]
```

An optional offer can accompany a recommendation.

**271 if statements**

- **112** Intent & constraint grounding
- **95** Plan & state validation
- **38** Supported request recognition
- **26** Preferences, references & task context

[Counting method and sources](./ai-stylist-decision-count.md)

[Presentation diagram](./ai-stylist-presentation.svg)

