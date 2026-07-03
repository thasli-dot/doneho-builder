I'll make the changes in the update brief across `DoneHoApp.tsx`, `aether.functions.ts`, and add a couple of small helpers. Everything below is scoped to UI/flow content — no new real backend logic (per your Hard Rules).

## Onboarding
1. **Remove** the full "Let's Get to Know You" form (Screen 3 today).
2. **Replace** with a single Aether chat bubble asking: *"What should I call you, and what do you do for work?"* — one text input, collects Name + Profession only.
3. Add a separate **optional Profile screen** (age, gender, location) reachable from the Dashboard / Profile tab, labeled *"Optional — helps with future personalization features."*

## Goal selection (Screen 4/5)
4. Expand goal list to the exact 10 categories in the brief: Study and Learning, Career and Work, Health and Wellness, Family and Childcare, Financial Planning, Life Skills and Improvement, Relationships and Social, Home and Household, Leisure and Recreation, Spiritual and Mindfulness.
5. Rewrite `computeLifeLoad` to use the live formula: `100 × (0.35·avg_Traffic + 0.35·avg_Volatility + 0.30·CommitmentRatio)` with `CommitmentRatio = 0.75` placeholder. Recalc on every slider move.
6. **Gate the Commit / Activate Priority Blueprint button**: disabled when LifeLoad > 65.
7. If no selected goal is *Leisure and Recreation* or *Spiritual and Mindfulness*, show: *"No leisure planned this week — burnout risk."*

## Hours + tasks (Screen 6 — Aetherization)
8. Replace the free hours slider with a **constrained recommended-range slider**: min 4, max 6, default 5, labeled *"Recommended: 4–6 hrs/day."*
9. Rename all "generate plan" copy to **Aetherization / Aetherize** consistently.

## Goal Clarification (NEW, before Blueprint)
10. Add a short chat step: for any entered task under 3 words, Aether asks a single clarifying question (e.g. *"For 'Learn Python' — starting from scratch, or brushing up?"*). Skip silently if nothing is flagged.

## Blueprint display
11. Group Blueprint visually by **Goal → Task → milestones** (placeholder milestones per task), with the existing High/Medium/Low focus badge per goal section. Add a **Regenerate** button.

## Pass-2 refinement (NEW, after first Blueprint)
12. Add a screen with tick-list checkboxes: Childcare/caregiving, Eldercare, Planned event this week, Sleep/commute different, Something else. If any ticked → Aether asks one combined follow-up. Otherwise skip.

## Dashboard (Screen 8 — Command Center)
13. **Remove** Resilient 70 and Consistency streak widgets.
14. Keep Life Load Trend, Current Focus, Upcoming High-Impact Tasks, Weekly Snapshot — clearly styled as mock/placeholder.
15. Add **"Something happened? Tell me."** disruption input → submit shows *"Got it — updating your week…"* and briefly re-animates Blueprint / Opportunity Map / Day Boosters / Smart Spend panels.
16. Add **"Modify goals/tasks"** action: task-only edit re-animates only Blueprint; goal add/remove re-animates Blueprint + LifeLoad.
17. Add **Regenerate** buttons on Day Boosters, Opportunity Map, Smart Spend panels (re-shuffle mock/AI content).

## Opportunity Map
18. Add a **Text ↔ Visual** toggle. Visual mode renders each suggestion as a small boxes-and-arrows flow with short labels. Keep the existing "Saves X mins" badge + short "How to:" line in text mode.

## Day Output (Screen 12)
19. Keep as-is per brief. Verify recovery message stays outcome-only ("your blueprint stays intact"), and remove any lingering reserve-hour numbers anywhere in the UI.

## Aether system prompt (`aether.functions.ts`)
20. Update the app knowledge: new 10 goal categories, new LifeLoad formula/gate, new onboarding flow (Name+Profession only), Aetherization terminology, no reserve numbers ever shown, new Blueprint grouping, disruption input, Modify flow, tick-list refinement step.

## Files changing
- `src/components/DoneHoApp.tsx` — most of the work (new Screen3 chat, new Screen 6.5 clarification, new Screen 7.5 refinement tick-list, rewritten Screen 5/6/8, new Profile section, new dashboard widgets).
- `src/lib/aether.functions.ts` — updated system prompt only.

## Hard rules I'll keep
- No new "real" logic beyond the LifeLoad live formula.
- Short, plain-English copy everywhere.
- Never show a Reserve Hours number anywhere.
- Keep current colors, fonts, Aether character, and overall layout.