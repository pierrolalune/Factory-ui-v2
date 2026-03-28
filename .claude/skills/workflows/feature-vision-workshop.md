# Feature Vision Workshop

Interactive brainstorming workflow that turns a rough feature idea into a refined, deeply-thought-through vision. This is a **conversation**, not an autonomous pipeline — every step requires user input.

## Phase 1: UNDERSTAND — What are we really solving?

The facilitator starts by deeply understanding the idea. One question at a time.

### Opening

Read the raw feature idea from `$ARGUMENTS`. Then:

1. **Restate** the idea back to the user:
   - "Here's what I'm hearing: you want to [restatement]. Is that right, or am I missing something?"

2. **Codebase scan** (background, while talking):
   - Launch an **architect subagent** (subagent_type: "architect") in read-only mode
   - Task: Scan the repository for anything related to this feature — existing modules, patterns, data models, TODO comments, stub routes
   - The facilitator uses these findings throughout the conversation

3. **5 Whys** — Peel back layers, one question per message:
   - "Who specifically would use this? Paint me a picture of that person."
   - "What can they absolutely NOT do today without this feature?"
   - "What happens if we don't build this — what's the cost of doing nothing?"
   - "Is this solving a pain point (something broken) or creating delight (something new)?"
   - "What triggered this idea? Something you saw, a user complaint, a competitor, a hunch?"

4. **Share codebase findings**:
   - "I looked at the codebase. Here's what I found that's relevant: [summary]"
   - "These existing modules/patterns could be leveraged: [list]"
   - "There's nothing related yet" (if applicable)

5. **Confirm understanding**:
   - "So to make sure I've got it: the core problem is [X], for [persona], and the gap is [Y]. Sound right?"

**Gate**: User confirms the facilitator understands the core problem. This is the only explicit gate — all others are natural conversation flow.

---

## Phase 2: DREAM — What's the 10x version?

Expand the possibility space. The facilitator brings in experts to push thinking.

### CEO Challenge

Launch **ceo-founder subagent** (subagent_type: "ceo-founder") in SCOPE EXPANSION mode.
- Task: Given this feature idea and codebase context, what's the 10-star version? What would make users tell their friends? What could this become if we dream big?
- Read the CEO's output

Present to user:
- "I asked our visionary to dream big on this. Here's what they came back with: [synthesized vision]"
- "The question is: **what would make this 10x more valuable for only 2x more effort?**"
- Wait for user's reaction

### Architecture Possibilities

Launch **architect subagent** (subagent_type: "architect") in read-only mode.
- Task: Given this feature idea and the current architecture, present 2-3 possible technical approaches — from simple to ambitious. What's technically possible? What would each approach unlock?
- Read the architect's output

Present to user:
- "From a technical standpoint, here are the directions we could take:"
- "**Option A** (simplest): [description] — gets us [X], effort ~[N] points"
- "**Option B** (balanced): [description] — gets us [X+Y], effort ~[N] points"
- "**Option C** (ambitious): [description] — gets us [everything], effort ~[N] points"
- "Which direction excites you?"

### UX Vision

Launch **ux-designer subagent** (subagent_type: "ux-designer") in read-only mode.
- Task: Given this feature idea, describe the ideal user experience. What does the flow feel like? What are the key interaction moments? What states exist (loading, empty, error, success)?
- Read the UX designer's output

Present to user:
- "Here's what the experience could feel like from a user's perspective: [synthesized UX vision]"
- "The key moments are: [list of interaction highlights]"

### Synthesis

- "Putting it all together, here's the full picture of what we could build: [unified vision combining CEO ambition + technical options + UX flow]"
- "The ambitious version is [A]. The pragmatic version is [B]."
- "**What excites you? What feels right?**"

---

## Phase 3: GROUND — What's realistic?

Bring the dream back to earth. Identify constraints, trade-offs, and risks.

### Feasibility Check

Launch **architect subagent** (focused analysis based on the direction user chose in Phase 2):
- Effort estimate (Fibonacci: 1, 2, 3, 5, 8, 13)
- Technical constraints and hard dependencies
- What existing code can be reused vs. what's new
- What's straightforward vs. what's the hard part

### Risk Assessment

Launch **lead-dev subagent** (subagent_type: "lead-dev"):
- What could go wrong in production? (race conditions, data integrity, scaling)
- Performance implications? (real-time, batch processing, database load)
- Backwards compatibility? Migration needs?
- Any hidden complexity?

Optionally launch **security subagent** (subagent_type: "security") if the feature touches auth, user data, or external APIs:
- OWASP concerns
- Data privacy implications
- Threat model highlights

### Present Trade-offs

- "Here's the reality check:"
- "**Easy parts**: [list] — these are straightforward given what already exists"
- "**Hard parts**: [list] — these will take the most time and carry the most risk"
- "**Risks to watch**: [list from lead-dev + security]"
- "My recommendation for a first version: [specific scope suggestion]"

### Scope Discussion

- "Given all this, let's talk scope:"
- "What's the absolute Must-Have — the thing that makes this feature worth building?"
- "What would be great to have but could wait for v2?"
- "What should we explicitly put out of scope to keep this focused?"
- "What must absolutely NOT be compromised — what's the non-negotiable?"

---

## Phase 4: SHAPE — Let's define it

Collaboratively write the feature brief. This is iterative — propose, get feedback, refine, repeat.

### Draft the Brief

Based on everything discussed, the facilitator drafts a feature brief:

```markdown
## Feature Brief: [Name]

**Problem**: [What we're solving and for whom — from Phase 1]
**Solution**: [What we're building — the core idea refined through Phases 2-3]
**User Experience**: [How users will interact with it — from UX vision]
**Technical Approach**: [High-level architecture direction — from Architect's recommended option]
**Scope**:
  - Must Have: [from scope discussion]
  - Should Have: [from scope discussion]
  - Out of Scope: [from scope discussion]
**Risks**: [Key risks from Lead Dev + Security]
**Effort**: [Fibonacci estimate from Architect] — [brief rationale]
**Success Criteria**: [How we'll know it works — measurable outcomes]
**Open Questions**: [Anything still unresolved]
```

### Present and Iterate

- "Here's what I've captured from our conversation. Take a look:"
- [Present the full brief]
- "**What needs to change?** Anything missing, wrong, or not quite right?"
- User gives feedback → facilitator revises → present again
- Repeat until user is satisfied

---

## Phase 5: DECIDE — What do we do with this?

Present the final brief and offer next steps.

Use AskUserQuestion:
- **A) Add to factory seeds** — Write this feature to `.claude/state/factory-seeds.md` so the Feature Factory picks it up. Also save the full brief to `Docs/specifications/vision/`.
- **B) Generate full spec first** — Run the `feature-spec.md` workflow to turn this brief into a complete technical spec with user stories, acceptance criteria, and technical design. Then add to factory seeds.
- **C) Keep exploring** — Go back and dig deeper on something. Which phase do you want to revisit?
- **D) Save for later** — Save the brief to `Docs/specifications/vision/` but don't add to factory seeds yet. You can add it manually later.

### If A: Add to factory seeds

1. Append to `.claude/state/factory-seeds.md`:
   ```
   - {Feature Name}: {One-sentence description from the brief}
   ```
2. Save the full brief to `Docs/specifications/vision/{kebab-name}-vision.md`
3. Confirm: "Done! '{Feature Name}' has been added to the factory seeds. When you run `/factory`, it will be the next feature tackled."

### If B: Generate full spec

1. Save the brief to `Docs/specifications/vision/{kebab-name}-vision.md`
2. Hand off to `feature-spec.md` workflow with the brief as input
3. After spec is complete, append to `.claude/state/factory-seeds.md`
4. Confirm: "Full spec generated and added to factory seeds."

### If C: Keep exploring

- "Which aspect do you want to revisit?"
  - A) The problem and who it's for (Phase 1)
  - B) The possibilities and ambition (Phase 2)
  - C) The constraints and trade-offs (Phase 3)
  - D) The brief wording and scope (Phase 4)
- Jump back with full context preserved

### If D: Save for later

1. Save the brief to `Docs/specifications/vision/{kebab-name}-vision.md`
2. Confirm: "Brief saved. When you're ready, add it to `.claude/state/factory-seeds.md` or run `/factory \"{Feature Name}\"`."

---

## Multiple Features in One Session

If the user wants to discuss another feature after finishing one:
- "Want to explore another idea? Just tell me what's on your mind."
- Start fresh at Phase 1 with the new idea
- Previous discussion context is preserved in case the user references it

---

## Workflow Summary

```
Phase 1  │ UNDERSTAND  │ Facilitator + Architect (scan) │ 5 Whys, codebase context
Phase 2  │ DREAM       │ + CEO + Architect + UX          │ 10x vision, tech options, UX flow
Phase 3  │ GROUND      │ + Architect + Staff Eng [+Sec]  │ Feasibility, risks, trade-offs, scope
Phase 4  │ SHAPE       │ Facilitator + User              │ Draft brief, iterate until satisfied
Phase 5  │ DECIDE      │ Facilitator                     │ Add to seeds / full spec / keep exploring / save
```

**Human touch points**: ALL of them (fully interactive)
**Veto authorities**: None — the user decides everything
**Total agents**: 1 lead (facilitator) + up to 5 specialists on demand
**Output**: Feature brief → optionally written to `factory-seeds.md`