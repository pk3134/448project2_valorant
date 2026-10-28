# HUD reaction test

Measures how fast a tester notices a HUD warning, comparing the current Valorant HUD with our redesign.

## Run it
Double-click `index.html`. It opens in your browser and needs no install or internet.

## How a session works
1. Pick **Version A** or **Version B** (alternate: 1st tester A, 2nd B, 3rd A, …).
2. Read the "Read this to the tester" box out loud and run the **Practice round**, which is not saved.
3. Press **Start test**. Each trial shows a normal HUD, then a warning appears after 2–6 seconds.
4. The tester presses **Space** as soon as they notice it, then picks what they saw (keys 1–5).
   While waiting, small orange targets pop up next to the crosshair and the tester **clicks the mouse** to shoot them, like Aim Lab. This keeps their eyes in the center like a real fight. Every target is shot the same way, so there's nothing to judge and no wrong presses; a missed target is fine. Turn it off in `config.js` (`centerTask.enabled: false`).
5. A Space press before the warning is a false start, and that same trial starts again, so the order never changes. No press within 5 seconds counts as missed.
6. Press **Esc** to stop early. Finished trials are kept.

## Low HP: 100 → 40 → 14
Low HP trials drop in two steps. HP shows 100, then 40 after the random wait, then 14 two seconds later if the tester hasn't pressed yet. The clock starts at 40, so pressing at 40 or at 14 both count, and time is measured from the 40 frame. Change `midMs` in `config.js` to change the 40 → 14 gap.

## Trial order
Every tester does 8 trials (Low HP, Ammo, Ability, Map) in a fixed order, alternating current and redesign. Version B is version A with every trial flipped (set in `config.js`, `orderA`). The spike timer has its own test, see below.

| Trial | Version A | Version B |
|---|---|---|
| 1 | Map · Current | Map · Redesign |
| 2 | Ability · Redesign | Ability · Current |
| 3 | Low HP · Current | Low HP · Redesign |
| 4 | Ammo · Redesign | Ammo · Current |
| 5 | Ability · Current | Ability · Redesign |
| 6 | Map · Redesign | Map · Current |
| 7 | Ammo · Current | Ammo · Redesign |
| 8 | Low HP · Redesign | Low HP · Current |

Test an even number of people, half on A and half on B.

## End of test
The last screen shows each trial's time (ms) and whether the answer was correct, plus average time and accuracy for current vs redesign. **Copy for Google Sheets** copies the table; click a cell in Sheets and paste.

## Results
- The results screen shows the average time to notice and % correct, per problem, current vs redesign.
- **All saved testers** combines everyone tested on this computer and browser.
- Use **Download CSV** to put the data in Google Sheets or Excel for the slides.
- Results are saved in this browser only. If teammates test on their own laptops, each person downloads a CSV and you merge them.

## Use your Figma frames
The `frames/` folder has placeholder images so the test runs today.
1. In Figma, export each frame as PNG at 1920×1080.
2. Put them in `frames/`.
3. Open `config.js` and change the file names (for example `frames/lowhp-after-warning.png`).

Each problem needs 4 images:

| File | What it shows |
|---|---|
| `before-normal` | Current HUD, nothing happening |
| `before-warning` | Current HUD with the warning (low HP, low ammo, …) |
| `after-normal` | Redesign, nothing happening |
| `after-warning` | Redesign with the warning |

The normal and warning images must be the same scene, so the only thing that changes is the warning.

Note: in the current game the spike timer has no visual change, so the spike "before" frames are identical and testers will mostly miss them. That is expected, and it is part of the finding.

## Change settings
Everything is in `config.js`: trials per version, delay range, timeout, answer choices and frame files.

## Spike test (separate)
Double-click `spike.html`. Each trial shows a spike screenshot and the tester decides as fast as possible: **F = I can defuse**, **J = too late, save**. It records the time and whether the decision was right, for the current HUD and the redesign, with the same Version A/B setup.

To add spike situations, put the images in `frames/spike/` and add a line per situation in `spike-config.js`: the current-HUD image, the redesign image, the time left, and the right answer. The A/B order is built automatically from that list (versions alternate, B is A flipped).

## Pasting into the results sheet
Both "Copy for Google Sheets" buttons copy just the numbers for the tester's block (EFFICIENCY = time in ms, ORIGINAL then REDESIGN; EFFECTIVENESS = correct, ORIGINAL then REDESIGN).
- Main test: click the **HP** row's first ORIGINAL cell and paste. It fills HP, AMMO, MAP and ABILITY (1 = correct, 0 = wrong; a blank time means missed).
- Spike test: click the **SPIKE** row's first ORIGINAL cell and paste. Time is the average; effectiveness is the share correct (1 = all right).
