# Workflow Orchestration

## Workflow Orchestration

Six strategies for effective workflow:

### 1. Plan Node Default

- Enter **plan mode** for any non-trivial task (3+ steps or architectural decisions)
- **STOP and re-plan immediately** if a task deviates from the plan—don't keep pushing
- Use plan mode for verification steps, not only for building
- Write detailed specifications upfront to minimize ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep the main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, leverage subagents to throw more compute at the issue
- Each subagent should have **one task** for focused execution

### 3. Self-Improvement Loop

- Update `tasks/lessons.md` with a specific pattern after **any correction from the user**
- Write personal rules to prevent repeating the same mistakes
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at the start of a session for relevant projects

### 4. Verification Before Done

- **Never** mark a task complete without proving it works
- Carefully differentiate behavior between `main` branch and current changes
- Ask: "Would a staff engineer approve this?"
- Run tests, check logs, and demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes, pause and ask: "is there a more elegant way?"
- If a fix feels hacky, implement an elegant solution based on current knowledge
- Skip this for simple, obvious fixes to avoid over-engineering
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: **just fix it.** Don't ask for hand-holding
- Address logs, errors, and failing tests, then resolve them
- Aim for zero context switching required from the user
- Go fix failing CI tests without being told how

---

## Task Management

Six-step process:

1. **Plan First** — Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan** — Check in before starting implementation
3. **Track Progress** — Mark items complete as you go
4. **Explain Changes** — High-level summary at each step
5. **Document Results** — Add review section to `tasks/todo.md`
6. **Capture Lessons** — Update `tasks/lessons.md` after corrections

---

## Core Principles

- **Simplicity First** — Make every change as simple as possible. Impact minimal code.
- **No Laziness** — Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact** — Changes should only touch what's necessary. Avoid introducing bugs.
