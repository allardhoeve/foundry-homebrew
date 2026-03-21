## Instructions for code
- Our Foundry version is 13 build 351.
- Only develop against the V2 Application framework (`foundry.applications.api.ApplicationV2`).

### Please note deprecations
- The renderChatMessage hook is deprecated. Please use renderChatMessageHTML instead, which now passes an HTMLElement argument instead of jQuery.

## Recording TODOs

TODOs are always written with `[ ]` syntax so it is clear what is done.

## Task names

Related tasks are always recorded in todo/tasks/ with name syntax: task-xxx-theme-name-xxxxx.

## CSS

Avoid using in-line CSS in the JavaScript. This causes bugs. Create a class in the CSS on top of the macro,
then use that class to style the element.

When building UIs, follow the shared conventions in `docs/ui-design-guide.md`.

## Testing

### Test types

Choose based on this heuristic:

- **BDD (Playwright)**: All conditions and assertions are things you can **see or do** in the UI. The test never needs to control or know about implementation details. Uses Gherkin feature files in `tests/features/`.
- **Unit**: Any condition requires **knowing or controlling an implementation detail** (e.g., forcing a die roll to a specific value, checking threshold math, testing state transitions with specific inputs).

When both could work, prefer unit — it's faster and more deterministic.

**Key distinction:** if a test step says "when X happens" and X is something the user *does* (clicks a button, opens a window), it's BDD. If X is something the *code* does internally (rolls a 1, calculates a fraction), it's unit.

### Three-layer testing approach

1. **Spec docs** — describe building blocks of each UI feature: what the elements are, what each mode/state looks like, what the design intent is. Stored alongside design docs. Tests reference these.
2. **Assertion tests** — automated pass/fail BDD tests that verify the specs. "Compact mode shows a circular portrait and a single status line, no animation." These are the safety net.
3. **Eye tests** — BDD scenarios that capture structured snapshots of the current UI state (visible elements, text content, applied classes). Not pass/fail — these let Claude "see" the UI by reading test output instead of manually exploring the DOM. These are Claude's glasses.

Assertion tests catch regressions. Eye tests let Claude inspect work without burning tokens on exploratory DOM reads.

### When to write tests

- **Building a new UI feature**: Write BDD assertion tests that describe what the UI should look like and how it should behave. Write eye tests for each distinct mode/state so you can inspect your own work. Write unit tests for any internal logic the feature introduces (state decisions, calculations, data transformations). Do this alongside the implementation, not after.
- **Adding or changing internal logic** (thresholds, calculations, state machines, dice mechanics): Write unit tests with controlled inputs covering the key branches. Do this before or alongside the change.
- **Fixing a bug**: Write the test that would have caught it (unit or BDD, whichever fits), then fix the bug.
- **Refactoring**: Run existing tests before and after. Only write new tests if the refactor changes observable behaviour.

When in doubt, ask: "Could this break silently?" If yes, write a test.

### Tests as a planning tool

When planning a new feature, draft BDD scenarios early — before writing code. Distill them from what the user has already described (conversation, design docs, task descriptions), then fill in gaps by asking targeted questions. If you can't describe what the user should see or experience as a result of a behaviour, you don't understand the requirement yet. Share the draft scenarios with the user for feedback; they double as a readable spec that both sides can agree on before implementation starts.

See `docs/TESTING.md` for BDD infrastructure details.

## Committing

If you commit at the user's request, or if you deem this necessary, always record if the commit is part of a task. This should be in the title ("task-051: something something summary").

If the commit is unrelated to a single task, try to commit changes grouped by task.

```
Succinct summary of changes

Task 051:
- This changed
- That changed

Task 052:
- Something changed
- Something else changes

Other things:
- More things
- Things happen
```