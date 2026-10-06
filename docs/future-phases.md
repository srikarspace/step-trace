# Future phases

Step Trace v1 shows **what happened** in a shrek-code run: every LLM response, every tool it ran, and what came back. That covers today's shrek.

This doc lists where Step Trace could go next. None of it is built yet. shrek-code is still young, so most of these features would have little to show. Each phase below says **when it becomes worth building**. Come back to this list when shrek reaches that point.

---

## Why go beyond v1?

People building coding agents keep asking four questions that a plain list of steps doesn't answer well:

1. **What did the model actually see?** When the agent makes a strange choice, the cause is usually in what it was given, not in the model.
2. **Where did it go wrong or waste effort?** Loops, retries, and huge tool outputs are easy to miss when scrolling 200 rows.
3. **What did it do to my repo?** You care about "changed 3 files", not 40 separate Edit rows.
4. **Is my new version of the agent better or worse?** After you change shrek's prompt or code, you want a before/after comparison.

Each phase below answers one of these.

---

## Glossary

| Term | Meaning |
|---|---|
| **Transcript** | The file shrek writes for each run: `~/.shrek/projects/<project>/<id>.jsonl`. |
| **JSONL** | "JSON Lines": one JSON object per line. Each line is one event (user message, assistant reply, tool result, …). |
| **Step** | One row in Step Trace's table. The parser (`src/parser/shrek.ts`) turns transcript lines into steps. |
| **LLM call** | One request to the model and its reply. Shown as `LLM response N`. |
| **Tool call / tool result** | The model asks to run a tool (e.g. `Bash ls`), shrek runs it and sends the output back. Step Trace joins them into one row. |
| **Tokens** | The units models read and write. Roughly 4 characters of English ≈ 1 token. Cost and limits are counted in tokens. |
| **Context window** | Everything the model is sent on one call: system prompt, tool definitions, and the whole conversation so far. It has a size limit (e.g. 200k tokens). |
| **Cached tokens** | Parts of the context the provider already saw on an earlier call. They're cheaper and faster. Reported in `usage.cached`. |

---

## Phase 2 · Context Inspector: what the model saw

**What it is.** Click any `LLM response` row and open a new **Context** tab. It shows everything the model was sent on that call as a stacked bar, one coloured segment per part:

```
LLM response 3 — 18,400 tokens in
[ system 2.1k | user 0.3k | response 1 0.4k | Bash result 14.9k | response 2 0.7k ]
                                              ^ this one is 81% of the context
```

Click a segment to jump to the step it came from. The overview strip at the top also gets a **context growth** lane: one bar per LLM call, so you can see where context suddenly jumped.

**Why it matters.** A lot of bad agent behaviour comes from bad context. For example, one `cat` of a huge log file fills the window and the model forgets the original request. You can't see that in v1.

**How it works (no shrek changes needed).** On each call, shrek sends the model the conversation so far, and the transcript *is* that conversation, written line by line. So the input to call N is the system prompt plus every message before call N. We rebuild it by replaying the transcript.

Token counts per segment are estimated (characters ÷ 4), then scaled so they add up to the real `usage.in` number shrek recorded for that call.

**Example.** A run with 3 LLM calls:
- Call 1 sees: system + your request.
- Call 2 sees: the above + response 1 + the `Read` result.
- Call 3 sees: the above + response 2 + the `Bash` result.

If call 3 is suddenly 5× bigger than call 2, the bar shows that the `Bash` result is responsible.

**Where the code would go.**
- `src/parser/context.ts`: rebuilds the segments for each LLM call (a pure function, easy to unit test).
- `src/parser/types.ts`: new `ContextSegment` type.
- `src/features/detail/tabs/Context.tsx`: the new panel tab.
- `src/features/overview/lanes.ts`: the context growth lane.

**Build it when** shrek runs get long enough to come near the context limit, or shrek starts summarizing ("compacting") old messages.

---

## Phase 3 · Agent Lint: where it went wrong

**What it is.** A linter (like ESLint) for agent runs. It scans a run and flags known bad patterns. Each finding points at the exact steps involved.

| Rule | What it catches | Example |
|---|---|---|
| **loop** | Same tool with the same arguments 3+ times | `Read src/app.ts` ×4 in a row |
| **retry storm** | A tool fails and is retried right away, again and again | `Bash bun test` fails 5× with the same error |
| **fat result** | One tool result takes up a big share of the next call's context | `Bash cat build.log` returns 40k tokens |
| **blind edit** | Editing a file the agent never read | `Edit config.ts` without a `Read config.ts` first |
| **dead read** | A file was read but never used afterwards | Read 6 files, used 1 |
| **stalled** | Long reasoning with no action, or a tool left `pending` at the end | Run ends mid-tool |

**How it looks.** An **Insights** bar above the table ("2 loops · 1 fat result"), a small badge on flagged rows, and a new filter token (`lint:loop`) that reuses the existing filter parser in `src/features/filter/filter.ts`.

**How it works.** It's one pure function, `lint(session) → Finding[]`, with one small rule per pattern. Each rule only reads the steps the parser already builds, so it's easy to test with fixtures.

**Where the code would go.** `src/features/lint/rules.ts`, `lint.test.ts`, `InsightsBar.tsx`.

**Build it when** shrek runs regularly loop or retry, or runs get too long to scan by eye.

---

## Phase 4 · Workspace Effect: what it did to the repo

**What it is.** A second view next to the step table, **Steps | Files**. The Files view lists every file the agent touched, with how many times and how many lines were added/removed. Click a file to see its net diff. Each change links back to the step that made it.

A **scrubber** lets you see the repo "as of step N": move it back and the diff shows only the changes made up to that step. This is a form of time travel.

**Why it matters.** 40 `Edit` rows tell you less than "changed `api.ts` (+30 −4), `types.ts` (+2), created `api.test.ts`".

**How it works.** `Write` gives full file contents. `Edit` gives old and new text. Apply them in order, per file, to rebuild each file's history (this is called "folding" the steps). Bash commands that change files (`mv`, `rm`, `sed -i`) are harder to track and come later.

**Where the code would go.** `src/features/files/fold.ts` (+ tests), `FilesView.tsx`, `Diff.tsx`, plus a `view` field in `src/store/ui.ts`.

**Build it when** shrek routinely edits several files per run.

---

## Phase 5 · Run Diff: better or worse than last time

**What it is.** Pick two runs (for example, the same prompt before and after you changed shrek) and see them side by side, with matching steps lined up:

```
Run A (before)            Run B (after)
Read  src/app.ts          Read  src/app.ts
Bash  bun test   ✗        —
Edit  src/app.ts          Edit  src/app.ts
Bash  bun test   ✓        Bash  bun test   ✓
```

A header shows the totals that changed: steps, tool errors, tokens, cost, time, lint findings, and how the run ended.

**Why it matters.** Every time you change shrek's prompt, model, or tools, you need to know whether runs got better. Today that means opening two runs and comparing them by eye.

**How it works.** Lining up two lists with gaps is a classic problem called **sequence alignment**. `git diff` and DNA comparison use the same idea (algorithms like Needleman-Wunsch or LCS). Each step becomes a key like `(tool, normalized arguments)` and the algorithm finds the best match between the two lists.

**Where the code would go.** `src/features/compare/align.ts` (+ tests), `CompareView.tsx`, and `?a=…&b=…` in `src/hooks/useUrlSync.ts` so a comparison can be shared as a link.

**Build it when** you're iterating on shrek's prompts or models and want before/after evidence.

---

## Later ideas (not scheduled)

- **Fork & replay:** pick a step, change its tool result, and let shrek continue from there ("what if the test had passed?"). Needs a hook in shrek.
- **Step → test fixture:** mark a bad step and export it as a regression test case for shrek.
- **Cross-run dashboard:** error rate per tool and cost per run, over many sessions.
- **Explain this failure:** ask Claude to summarize why a run failed. Needs an API key, opt-in only.
- **Claude Code adapter:** read Claude Code transcripts too.
- **Sub-agent lanes:** show sub-agents as parallel lanes once shrek has them.
- **Testing and scale:** Playwright tests for the manual UI checks, and virtualization for very long sessions.

## Toolbar notes

The Live (●), Reload, and Clear-filters buttons haven't been tested against live shrek runs yet. Test them before changing anything. No changes planned until then.

## Suggested order

Phase 2 → 3 → 4 → 5, but let shrek decide: build whichever phase's "build it when" condition shows up first. All four are client-side only. They derive everything from the transcript and need no new backend.
