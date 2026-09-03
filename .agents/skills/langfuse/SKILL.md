---
name: langfuse
description: Interact with Langfuse and access its documentation. Use when needing to (1) query or modify Langfuse data programmatically via the CLI — traces, prompts, datasets, scores, sessions, and any other API resource, (2) look up Langfuse documentation, concepts, integration guides, or SDK usage, or (3) understand how any Langfuse feature works. This skill covers CLI-based API access (via npx) and multiple documentation retrieval methods.
allowed-tools:
  - WebFetch(domain:langfuse.com)
  - Bash(curl *langfuse.com/*)
  - Bash(npx langfuse-cli api __schema *)
  - Bash(npx langfuse-cli api * --help *)
  - Bash(npx langfuse-cli api * list *)
  - Bash(npx langfuse-cli api * get *)
---

# Langfuse Skill

This skill provides expert best practices for instrumenting LLM applications with Langfuse tracing, prompt registry, evaluations, and user feedback capture.

## Core Best Practices
1. **Model Name & Parameters**: Always capture model name, temperature, and token budgets on generation observations.
2. **Usage & Token Tracking**: Log prompt tokens, completion tokens, and total tokens on every generation to enable accurate cost telemetry.
3. **Descriptive Span Hierarchies**: Nest multi-step operations cleanly (`Query Rewrite` -> `Tree Search Navigation` -> `Answer Synthesis Stream` -> `Follow-Up Generation`).
4. **Input & Output Hygiene**: Capture sanitized inputs/outputs with PII masked to prevent sensitive data leakage.
5. **Prompt Versioning & Registry**: Link generation observations to versioned prompts in Langfuse.
6. **User Feedback & Scores**: Attach numeric quality scores (e.g. 0.0 - 1.0) and user ratings (thumbs up/down) to trace IDs.
