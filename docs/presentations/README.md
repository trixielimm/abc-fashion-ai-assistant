# AI walkthrough presentation

Open `ai-walkthrough.html` directly in a browser. It is a self-contained file with embedded screenshots and works offline. The live website link needs an internet connection.

The four stories contain 23 prompt stops: six for outfit discovery, six for the shared budget, six for changing preferences, and five for product questions. Every recorded stop includes a screenshot captured from https://abcandco.vercel.app/ after submitting its displayed prompt on 4 November 2026, plus the captured conversation messages.

## Controls

- Click a story or a point on the small map to enter it.
- Right or Space advances. Left goes back. Up opens the overview.
- Map hides or shows the navigation panel on the right without changing the current slide. On narrow screens it opens as an overlay.
- Escape returns to the overview.
- Down enters the selected story. Keys 1 to 4 choose a story from the overview.
- Click a screenshot to enlarge it. Copy prompt copies the displayed message.
- Audience votes use a show of hands and a manual selection. Alternate prompts marked as live options require continuing in the actual website. Their replies are not represented by the recorded screenshots.

Start a new chat in the website for each story. Keep that chat through the remaining prompts in the story.

## Sources and rebuilding

`ai-walkthrough.template.html` contains the presentation layout and interaction code. `ai-walkthrough-content.json` contains the story structure and observations. `ai-walkthrough-captures/manifest.json` records each submitted prompt, source URL, capture time, image, and original browser transcript. The original JPG files are unmodified website screenshots.

From the repository root, run:

```sh
node scripts/build-ai-walkthrough.mjs
```

The builder checks for missing captures, missing vote prompts, duplicate steps, and stories with fewer than four steps. It embeds the images and conversations into the output HTML.

## Recorded behavior

The presentation follows the real replies, including no-match results and clarification. Extra recovery steps explain the navy colour choice, the remaining bag allowance, and broadening the dress search. The budget sequence retains an initial response containing bags above the intended combined limit before an explicit A$55 allowance produces suitable prices. The product-rejection response also retains an unexpected clarification, and the guarantee answer does not directly resolve waterproofing. These captures should not be described as proof that every AI interpretation works correctly.

Browser checks covered all 23 stops, loaded images, camera centring, prompt copying, voting, image enlargement, keyboard navigation, and the narrow-screen layout. The conversation viewer has been removed. This task did not change the storefront or AI implementation.
