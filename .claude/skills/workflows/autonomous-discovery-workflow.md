# Autonomous Discovery Workflow

Analyze the current project and surface **substantial new feature proposals** — entirely new capabilities, screens, integrations, or user flows that do not exist yet. Adapted from Product_Discovery.md for **fully autonomous** pipeline use — no human checkpoints.

## Phase 1: Project Reconnaissance

Map the technical landscape and identify **new feature opportunities**.
- Scan the full codebase structure (modules, layers, API surface)
- Identify major capability gaps — entire systems, modules, or integrations that don't exist yet
- Spot architectural constraints that prevent adding significant new features
- Look for patterns in the codebase that suggest planned-but-unbuilt features (e.g., unused models, stub routes, TODO comments referencing features)
- **Ignore**: minor code quality issues, small refactors, cosmetic improvements
- Output: **Technical landscape map** — what exists, what major capabilities are missing, what new systems could be built

## Phase 2: Use Case Discovery

Translate findings into **new feature opportunities only**.
- For each major capability gap, write a clear use case:
  - Who is affected (which user persona)?
  - What are they currently **completely unable to do** (not "doing poorly")?
  - What is the business impact of the missing capability?
- Apply 5 Whys to surface the root need behind each gap
- **Strictly filter out**: anything that improves an existing feature rather than adding a new one
- Classify each opportunity: **New Feature / New Integration / New Screen or Flow / Major Architectural Enabler**
- Output: **Opportunity log** — structured list of new feature use cases

## Phase 3: Feature Ideation

Generate and frame **new feature** proposals.
- For each opportunity, formulate a concrete new feature proposal:
  - Name, description, target persona
  - What entirely new capability does this add?
  - Expected business value (quantified where possible)
  - Acceptance criteria (high-level, testable)
- Group related proposals into themes or epics
- Apply MoSCoW classification (Must / Should / Could / Won't now)
- **Final filter**: remove any proposal that is just an enhancement to an existing feature
- Output: **Draft new feature proposals**

## Phase 4: CEO Prioritization & Approval

Rank all proposals using WSJF.

## Phase 5: Backlog Write & Documentation

Write approved features to the backlog and create documentation.