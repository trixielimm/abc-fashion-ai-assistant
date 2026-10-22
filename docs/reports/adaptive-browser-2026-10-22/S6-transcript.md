# S6 — no suitable catalogue match

Direct interaction with the live customer browser at http://127.0.0.1:3003/ on 22 October 2026, Australia/Sydney. Four customer messages and four agent replies. Stopped when the agent supplied verified alternatives with visible compromises. Browser state files preserve the exact customer interface, including product links, prices, size labels and controls.

## Exchange 1

**Customer:** I need a navy shirt for work, men's medium, regular fit, no more than A$100. Please find the best match.

**Agent:** I couldn't reliably interpret the requested change. No unverified changes were applied. You can clarify the item and change, or start a new shopping task below.

## Exchange 2

**Adaptive reason:** Simplify the wording without changing any requirement after the interpretation failure.

**Customer:** Men's shirts, navy, size M, regular fit, under A$100, for work.

**Agent:** I couldn't find an available product that meets those details right now. Your stated limits and exclusions are unchanged.

One way to broaden the search is to use "Explore other colours" below. That preview keeps your other restrictions and leaves your original colour request saved.

The interface also labelled that choice as a preview which would retain the original colour and other restrictions.

## Exchange 3

**Adaptive reason:** The agent proposed exploring colours. Ask it to establish a useful, explicit compromise without silently changing the spending cap.

**Customer:** Which single change would give me the closest real shirt? Tell me the exact price and fit, and be explicit about the compromise. Don't raise my A$100 maximum without asking.

**Agent:** Would you like to remove the navy colour requirement while keeping the men's work shirt, size M, regular fit, and A$100 maximum? The compromise would be a different colour, with the price cap and fit unchanged.

## Exchange 4

**Adaptive reason:** Accept only the proposed colour relaxation; keep the other requirements firm.

**Customer:** Yes, any colour is fine. Keep men's work shirts, size M, regular fit and the A$100 maximum.

**Agent:** I haven't found an exact match for all the details you mentioned, but there are some alternatives you can consider.

Three cards appeared under **Alternatives — Details differ**:

- White Polo Shirt, P1308, A$95.00, size M listed. Differences: occasion Smart Casual instead of Work; fit Slim instead of Regular.
- Blue Oxford Shirt, P1098, A$50.00, size M listed. Differences: occasion Formal instead of Work; fit Oversized instead of Regular.
- Yellow Oversized Shirt, P1013, A$95.00, size M listed. Differences: occasion Formal instead of Work; fit Slim instead of Regular.

All three identities, prices, size labels, fits, occasions and catalogue availability were independently checked in the live catalogue snapshot. The Yellow Oversized Shirt's name conflicts with its recorded Slim fit; the agent displayed the recorded fit as a compromise rather than claiming an exact match.

The proposed colour relaxation alone did not make an exact match possible. The final cards disclosed the additional fit and occasion compromises. No discount, size-specific stock guarantee, delivery promise or optional addition was invented.

[Full cumulative browser state](S6-turn4.txt)

![Visible alternative details](S6-differences.png)
