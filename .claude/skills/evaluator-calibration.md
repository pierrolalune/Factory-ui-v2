# Evaluator Calibration Skill

Tunes the Final User evaluator based on past judgment accuracy. Invoked every 5th Feature Factory iteration to create a feedback loop that makes evaluations more accurate over time.

**Trigger**: Feature Factory Phase 9, when `iteration % 5 === 0`.

---

## Process

### Step 1: Collect Evaluation History

Read `.claude/state/final-user-reports.json`. Extract the last 5 Final User evaluations:
- Feature ID, name, score, verdict, dimension scores, P1/P2/P3 weaknesses
- Whether the feature was APPROVED, REVISED (how many rounds?), or REJECTED

### Step 2: Cross-Reference with Downstream Quality

For each feature that was APPROVED (score >= 80):

**Check improve-loop evidence**: Search `Docs/reports/IL-C*-*-retro.md` for any improve-loop cycle that targeted a recently APPROVED feature. If the improve-loop's discovery phase found issues that the Final User should have caught — that's a leniency signal.

**Check subsequent factory runs**: If a feature was shipped but later had bugs caught in a polisher cycle or QA run, cross-reference from `polisher-audit-trail.json` findings on the same files.

### Step 3: Analyze Revision Efficiency

For features that went through REVISE cycles:
- How many revision rounds before APPROVE? If consistently 3+, the feedback wasn't specific enough.
- Did the same P1 weakness recur across revision rounds? That means the Dev couldn't understand the fix instruction.
- Did the score improve by >= 5 points per revision? If not, feedback was too vague.

### Step 4: Detect Scoring Biases

Across the last 5 evaluations, check:
- **Dimension inflation**: Is one dimension consistently scored higher than others? (e.g., "Is It Polished?" always >= 20/25 while improve-loop later finds polish issues)
- **Severity mismatch**: Were items classified as P2/P3 that should have been P1? (Downstream evidence: those items caused user-facing issues)
- **Missing patterns**: Are there categories of issues that the evaluator never catches? (e.g., empty states, mobile responsiveness, error messages)

### Step 5: Produce Calibration Adjustments

Write specific, actionable amendments to `.claude/state/calibration-amendments.md`. Each amendment follows this format:

```markdown
### Amendment #{N} — {date}

**Trigger**: {what was observed in the evaluation data}
**Adjustment**: {specific change to scoring behavior}
**Applies to**: {which dimension or evaluation step}
**Example**: {concrete example of what to score differently}
```

**Examples of calibration adjustments:**
- "Weight 'Is It Polished' more strictly — the last 3 approved features had polish issues discovered in improve-loop Cycle 3 (Visual Polish angle). Specifically: check for missing hover states and empty state messages before scoring above 18/25."
- "Require explicit empty state verification for every new list/table component — 2 of 5 features shipped without empty states, caught only in improve-loop."
- "When a feature touches forms, always test with browser: empty submission, extremely long input, and special characters. Last 2 form features had validation gaps."
- "Revision feedback for P1 items must include the specific file and component name, not just 'the form needs better error handling.' Vague feedback caused 3+ revision rounds on FP-012."

### Step 6: Prune Stale Amendments

If an amendment is > 10 evaluations old and recent evaluations show the issue is resolved (no more occurrences), mark it as `[RESOLVED]` — keep it in the file for history but note it no longer applies.

---

## Output

- Updated `.claude/state/calibration-amendments.md`
- Brief calibration summary logged in the Feature Factory state file under `metrics.last_calibration`

## Non-Goals

- Do NOT change the scoring weights (that's a manual decision)
- Do NOT rewrite the Final User agent definition
- Do NOT modify past evaluation reports
- Amendments are additive guidance, not overrides — the Final User still uses their judgment
