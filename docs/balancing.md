# Balancing notes

`npm run balance` runs 10,000 random valid plans per night through the pure simulation
(random lanterns, random spots, Keeper walking the shortest order, never over budget),
tries every single-lantern placement, and runs a hill-climbing search to prove each night
is winnable. Latest full output: [`balance-report.txt`](balance-report.txt).

Random plans are far worse than a thinking player, so "win rate" here is a measure of how
forgiving a night is, not how hard it feels. Flags:

| Flag | Meaning |
|---|---|
| UNWINNABLE | search could not reach 1★ (script exits non-zero) |
| TRIVIAL | wins with no lanterns, or ≥20% of single lanterns earn 3★ |
| TOO EASY | >50% of random plans win, or >25% get 3★ |
| TOO HARD | <2% of random plans earn even 1★ |
| DOMINANT | one placement is in ≥5% of plans and gets 3★ ≥90% of the time |

## What the first run found, and what changed

| Night | Before | Change | After |
|---|---|---|---|
| 1 First Light | DOMINANT (one obvious spot) | Kept on purpose: it's the tutorial, one lantern, one villager, no text. | 13.6% win |
| 2 Two Gaps | TOO EASY: 51% win (1★ for saving 1 of 2) | Added a third villager behind the left gap; stars 2/3/3; oil 9 → 10 for a little slack. | 27.8% win, 3★ 0.4% |
| 4 Hedge Hopper | TOO EASY: 63% win (1★ for 1 of 2) | Stars 2/2/2 (both or nothing) made it 0.8%, so oil 9 → 11 to soften the Leaper's debut. | 4.3% win |
| 5 Across the Water | 3★ needed the exact budget | Oil 8 → 9. | 11.5% win |
| 10 The Long Night | One lantern next to the top house trapped *both* fogs: a one-move finale (not flagged, but thin) | Redesigned: fog on the left and right edges, pond in the middle, six villagers, stars 4/5/6. A single decoy now drags fog across the village; 6/6 needs a Flare + Lantern combination. | 28% win, 3★ 0.1% |

During level design (Milestone 4) the same tools caught: Nights 2–3 winnable with no lanterns
(villagers outran the fog), Night 3 solvable without the Beacon, Night 5 only half-solvable,
and Nights 7–8 winnable by almost any plan. Those were redesigned before this pass.

## Dominant-strategy check across nights

No lantern type has a large positive 3★ lift on more than its own introduction night, and
no single placement crosses the dominance threshold outside Night 1. Several nights have a
single *key* placement (Night 6's Flare, Night 7's decoy, Night 8's pie); random play finds
those in ~1% of plans, which is the puzzle working as intended rather than a dominant strategy.
