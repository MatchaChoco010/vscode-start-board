---
description: Execute single pending subtask using TDD methodology
allowed-tools: Read, Task, Glob
---

# Single Task Executor

## Auto-detect Feature

Find the active feature directory in `.kiro/specs/`:
1. List directories in `.kiro/specs/`
2. Exclude `archives` directory
3. There should be exactly one remaining directory - that's the active feature

If no feature found or multiple features exist (excluding archives), inform user to check spec structure.

## Validate

Check that tasks have been generated:
- Verify `.kiro/specs/{feature}/tasks.md` exists

If validation fails, inform user to complete tasks generation first.

## Task Selection Logic

**Find the first pending subtask**:
1. Read `.kiro/specs/{feature}/tasks.md`
2. Find all unchecked subtasks (`- [ ]` with format like `6.1`, `6.2`, etc.)
3. Select **only the first one** (e.g., if 6.1, 6.2, 6.3 are pending, select only 6.1)

## Invoke Subagent

Delegate TDD implementation to spec-tdd-impl-agent:

Use the Task tool to invoke the Subagent with file path patterns:

```
Task(
  subagent_type="spec-tdd-impl-agent",
  description="Execute TDD implementation",
  prompt="""
Feature: {feature}
Spec directory: .kiro/specs/{feature}/
Target task: {first pending subtask number, e.g., "6.1"}

File patterns to read:
- .kiro/specs/{feature}/*.{json,md}
- .kiro/steering/*.md

TDD Mode: strict (test-first)

IMPORTANT: Execute ONLY this single subtask. Do not proceed to subsequent tasks.
"""
)
```

## Display Result

Show Subagent summary to user, then provide next step guidance.

## Update Phase Completion Status

After the subagent completes its task successfully, check if the parent phase should be marked as complete:

1. **Re-read tasks.md**: Read `.kiro/specs/{feature}/tasks.md` to get the current state
2. **Identify parent phase**: Extract the phase number from the completed subtask (e.g., "6.1" → "6")
3. **Find all subtasks for this phase**: Gather all lines matching pattern `- [x| ] {phase}.{number}` (e.g., `6.1`, `6.2`)
4. **Check completion**: Verify ALL subtasks under this phase are checked (`- [x]`)
5. **Update phase status**: If ALL subtasks are complete, use the Edit tool to change `- [ ] {phase}. ...` to `- [x] {phase}. ...`

**Example**: If subtask 5.2 was just completed:
- Check: Is `- [x] 5.1` present? Yes
- Check: Is `- [x] 5.2` present? Yes
- Check: Are there any `- [ ] 5.{n}` remaining? No
- → Update `- [ ] 5. バリデーション...` to `- [x] 5. バリデーション...`

**IMPORTANT**: Only update the phase checkbox if ALL its subtasks are complete. Do not update if any subtask remains unchecked.

### Next Steps

After completion:
- Run `/impl` again to execute the next pending subtask
- Run `/kiro:spec-status {feature}` to check overall progress

### Purpose

This command is for executing tasks **one at a time** without specifying task numbers manually.
Use `/kiro:spec-impl {feature} 1.1` if you want to specify a particular task.
