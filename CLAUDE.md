## Instructions for code
- Our Foundry version is 13 build 351.
- Only develop against the V2 Application framework (`foundry.applications.api.ApplicationV2`).

### Please note deprecations
- The renderChatMessage hook is deprecated. Please use renderChatMessageHTML instead, which now passes an HTMLElement argument instead of jQuery.

## Recording TODOs

TODOs are always written with `[ ]` syntax so it is clear what is done.

## Task names

Related tasks are always recorded in todo/tasks/ with name syntax: task-xxx-theme-name-xxxxx.

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