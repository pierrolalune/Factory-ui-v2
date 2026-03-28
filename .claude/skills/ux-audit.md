# UX Audit

This skill enables the agent to perform comprehensive UX audits using established
heuristic frameworks, task flow analysis, and systematic usability evaluation.

## Use this skill when

- Conducting a full UX audit of a page or feature
- Performing heuristic evaluation (Nielsen's 10)
- Analyzing task flows for usability issues
- Reviewing error recovery patterns
- Checking consistency across the application
- Quick accessibility spot-check as part of UX review

## Do not use this skill when

- Doing a deep WCAG audit (use accessibility-audit)
- Comparing with Figma designs (use figma-design-sync)

## Instructions

### Nielsen's 10 Usability Heuristics

Evaluate each heuristic on a scale: ✅ Good | ⚠️ Issues | ❌ Failing

#### 1. Visibility of System Status

- Does the system always inform users about what is going on?
- Loading indicators for async operations?
- Progress bars for multi-step processes?
- Confirmation messages after actions?

```
Check: After clicking "Save", does the user see confirmation?
Check: During data loading, is there a skeleton/spinner?
Check: In multi-step forms, is there a progress indicator?
```

#### 2. Match Between System and Real World

- Does the language match the user's vocabulary?
- Are icons intuitive and recognizable?
- Do metaphors make sense?

```
Check: Is jargon avoided in user-facing text?
Check: Are icons standard (trash=delete, pencil=edit)?
Check: Does the information architecture follow user mental models?
```

#### 3. User Control and Freedom

- Can users undo actions easily?
- Is there always a way to go back?
- Can users cancel in-progress operations?

```
Check: Is there an "Undo" for destructive actions?
Check: Can users close modals with Escape?
Check: Can users navigate back from any page?
```

#### 4. Consistency and Standards

- Are similar elements styled consistently?
- Do icons mean the same thing everywhere?
- Is terminology consistent?

```
Check: Are all primary buttons the same color/style?
Check: Is "Delete" vs "Remove" used consistently?
Check: Do breadcrumbs follow the same pattern everywhere?
```

#### 5. Error Prevention

- Are dangerous actions guarded by confirmation?
- Is input validated before submission?
- Are defaults safe?

```
Check: Does "Delete Account" require confirmation?
Check: Does the form validate before submission?
Check: Are dangerous defaults avoided?
```

#### 6. Recognition Rather Than Recall

- Are recently used items visible?
- Are options visible rather than hidden?
- Is help contextual?

```
Check: Is navigation always visible (not hidden behind hamburger on desktop)?
Check: Are form labels visible (not just placeholders)?
Check: Are recent searches/items shown?
```

#### 7. Flexibility and Efficiency of Use

- Are there keyboard shortcuts for power users?
- Can experienced users skip steps?
- Are there bulk actions?

```
Check: Can users use Ctrl+K or / to search?
Check: Are there batch operations for lists?
Check: Can users customize their workflow?
```

#### 8. Aesthetic and Minimalist Design

- Is visual noise minimized?
- Is content prioritized by importance?
- Are decorative elements purposeful?

```
Check: Is the primary action the most prominent element?
Check: Is secondary information de-emphasized?
Check: Are there unnecessary visual elements?
```

#### 9. Help Users Recognize, Diagnose, and Recover from Errors

- Are error messages in plain language?
- Do they indicate the cause?
- Do they suggest a solution?

```
Check: Does "404" show a helpful message + navigation?
Check: Do form errors explain what went wrong AND how to fix it?
Check: Do API errors show user-friendly messages (not stack traces)?
```

#### 10. Help and Documentation

- Is contextual help available?
- Are tooltips provided for complex features?
- Is documentation searchable?

```
Check: Are complex fields explained with help text or tooltips?
Check: Is there an onboarding flow for new users?
Check: Is help easily findable?
```

### Task Flow Analysis

For each critical task:

```
Task: [e.g., "Create a new project"]
1. Entry point: Where does the user start?
2. Steps: How many steps/clicks to complete?
3. Friction: Where might the user get confused?
4. Error recovery: What happens if they make a mistake?
5. Confirmation: How do they know it worked?
6. Navigation: Can they easily return to their previous context?
```

### Consistency Checklist

| Element              | Page A      | Page B      | Page C       | Consistent? |
| -------------------- | ----------- | ----------- | ------------ | ----------- |
| Primary button style | Blue/filled | Blue/filled | Green/filled | ❌          |
| Heading hierarchy    | h1→h2→h3    | h1→h3       | h1→h2→h3     | ❌          |
| Error message style  | Red inline  | Red toast   | Red modal    | ❌          |
| Loading pattern      | Skeleton    | Spinner     | Nothing      | ❌          |

### Severity Rating

| Level       | Description                       | Example                      |
| ----------- | --------------------------------- | ---------------------------- |
| 🔴 Critical | Users cannot complete task        | Broken form submission       |
| 🟠 Major    | Users struggle significantly      | No error messages on form    |
| 🟡 Minor    | Users are annoyed but can proceed | Inconsistent button styles   |
| 🔵 Cosmetic | Polish issue, no impact           | Slight spacing inconsistency |

## Output Format

```
## UX Audit Report: [Page/Feature Name]
### Date: [Date]
### Evaluator: [Agent/Name]

### Executive Summary
[2-3 sentences summarizing overall UX quality and top issues]

### Heuristic Evaluation
| # | Heuristic | Rating | Key Finding |
|---|-----------|--------|-------------|
| 1 | Visibility of Status | ⚠️ | No loading indicator on search |
| 2 | Match Real World | ✅ | Language is clear and user-friendly |
| 3 | User Control | ❌ | No undo for delete actions |
| ... | ... | ... | ... |

### Critical Issues
1. 🔴 [Issue title] — [description + where]
2. 🟠 [Issue title] — [description + where]
3. 🟡 [Issue title] — [description + where]

### Task Flow Analysis
[Task details as described above]

### Recommendations (Priority Order)
1. [Highest impact fix]
2. [Second priority]
3. [Third priority]

### Score: X/10
```

## UX Implementation Patterns

When implementing fixes for audit findings, apply these patterns:

### Loading States
- **Skeleton screens** for content loading (preferred): `aria-busy="true"`, shimmer animation
- **Spinners** for actions/transitions: show after 300ms delay to avoid flash
- **Progress bars** for multi-step processes: show percentage or step count

### Error Recovery
- Inline error messages next to the field, not just toast/alert
- Always suggest how to fix, not just what went wrong
- Provide retry for network failures with exponential backoff
- Never lose user input on error — preserve form state

### Empty States
- **First-time**: Welcome + clear CTA to get started
- **No results**: Suggest modified search, show popular items
- **Error**: Explain what happened + retry button

### Form UX
- Validate on blur (not on every keystroke), clear error on change
- Use `inputmode` for mobile keyboards (`numeric`, `email`, `tel`)
- Group related fields with `<fieldset>` + `<legend>`

### Touch & Mobile
- Minimum touch target: 44x44px (WCAG 2.5.5)
- Adequate spacing between targets (8px minimum)
- No hover-dependent interactions on mobile
- Test at 375px, 768px, 1280px

### Microcopy
- Button labels describe the action ("Save changes", not "Submit")
- Error messages in plain language, not error codes
- Confirmation messages confirm what happened ("Project saved")

## Anti-patterns

- **NEVER** audit without actually interacting with the interface
- **NEVER** focus only on visual design — UX is about behavior and flow
- **NEVER** list issues without severity ratings — prioritization matters
- **NEVER** skip error and edge case scenarios — happy path isn't enough
- **NEVER** ignore mobile experience — test on small viewports
- **NEVER** provide vague recommendations — be specific about what to fix and where
- **NEVER** conflate personal preference with usability issues — reference heuristics
