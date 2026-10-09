---
description: Drive a feature from spec to shipped (design → plan → dev → review → test)
argument-hint: <one-liner describing the feature>
---

# /architect

Invoke the `architect-flow` skill and drive the following brief through its five phases
(Design → Plan → Implement → Review → Test), using the routing matrix in the skill to
delegate mechanical work to MLX (`mlx-local offload`) and larger scoped subtasks to the `general-purpose`
subagent.

## Brief

$ARGUMENTS

## If no brief was provided

Ask me a single clarifying question — "What feature do you want built end-to-end?" — then
proceed with the flow using my answer as the brief.
