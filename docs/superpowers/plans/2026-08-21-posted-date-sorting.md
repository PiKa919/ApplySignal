# Posted-Date Job Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show verified live jobs in newest-posted-first order while clearly distinguishing exact, relative, and unavailable posting dates.

**Architecture:** Keep sorting in the browser because this is a presentation preference over the existing `/api/jobs` payload. Sort exact ISO posted dates descending, then place jobs without an exact date after them using observation time as a transparent fallback. Reuse the sorted array for both job cards and comparison selectors.

**Tech Stack:** TypeScript browser UI, Bun test runner, existing HTML/CSS.

## Global Constraints

- Use only live API observations already returned by `/api/jobs`; do not add fixture or hardcoded job data.
- Do not spend Bright Data credits or change collectors for this UI-only feature.
- Keep source confidence and posting-date certainty as separate signals.
- Preserve listing links and existing keyboard-accessible card behavior.

### Task 1: Add regression coverage

**Files:**
- Modify: `tests/ui.test.ts`

- [ ] **Step 1: Write the failing test**

Assert that the UI defines posted-date fields, a newest-first sort helper, a transparent date label, and the visible sort status.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `bun test tests/ui.test.ts`

Expected: the new posted-date sorting test fails because the UI does not yet define the behavior.

### Task 2: Implement the UI behavior

**Files:**
- Modify: `src/ui/app.ts`
- Modify: `src/ui/index.html`

- [ ] **Step 1: Extend the job payload type**

Include `postedDate`, `postedDateQuality`, and `observedAt` in the browser-side `Job` type.

- [ ] **Step 2: Add deterministic sorting and labels**

Sort exact dates descending, use observed time for undated jobs, and render honest labels for exact versus unavailable dates.

- [ ] **Step 3: Use the sorted collection consistently**

Use the sorted jobs for cards, comparison options, count/status copy, and default comparison selection.

### Task 3: Verify the feature

- [ ] **Step 1: Run focused UI tests**

Run: `bun test tests/ui.test.ts`

- [ ] **Step 2: Run the full test suite and build**

Run: `bun test && bun run build`

- [ ] **Step 3: Inspect the diff**

Run: `git diff --check` and review only the planned files plus this plan.
