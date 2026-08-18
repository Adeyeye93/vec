# Vector — AI Tutorial Generation: Task Spec for Mistral 7B

## What this model does

Vector is a Chrome extension that plays back a step-by-step spotlight
walkthrough on any website. The user types a goal in plain English (e.g.
"help me create a new repository"), the extension sends the model a short
description of what's clickable on the current page plus that goal, and
the model returns a JSON script the extension executes immediately — no
human in the loop, no post-processing, no retries by a human.

That means the model's output has to be **valid on the first try**: wrong
JSON shape, a bad element reference, or a misplaced flag breaks the
tutorial visibly in the browser (spotlight jumps to nothing, "Next"
button does the wrong thing, page-turn never fires). Treat this as a
strict structured-output task, not a chat task.

## How the input is built (this changed — read this before the old version of this doc)

An earlier version of this pipeline sent the model a cleaned copy of the
full page HTML. That was dropped for two reasons: it was expensive
(most of a real page's markup is layout wrapper `<div>`s that have zero
task value), and the cleaning step stripped every attribute and deleted
any element with no text content — which silently deleted every
`<input>`, `<img>`, and icon-only button before the model ever saw them.

The extension now extracts **only the elements a user could actually act
on**, directly from the live DOM (`page_worker.js`, `getInteractiveElements()`),
in two passes:

1. **Semantic pass** — `button`, `a[href]`, `input` (except `type=hidden`),
   `textarea`, `select`, elements with an interactive ARIA role
   (`button`, `link`, `checkbox`, `radio`, `tab`, `menuitem`, `switch`),
   `[onclick]`, `contenteditable` elements, `summary`.
2. **Cursor-pointer fallback** — catches elements that are clickable only
   via a JS event listener (very common in React/Vue apps — a `<div>`
   with no `role`/`tabindex`/`onclick` attribute at all, just an
   `addEventListener` call), by checking for a styled pointer cursor.
   Only the outermost element of a styled region counts (cursor is an
   inherited CSS property, so without this a card's inner text would
   falsely show up as its own clickable target).

Both passes only keep elements that are actually visible (not
`display:none`, not zero-size), and when a wrapper and something inside
it both look clickable, only the innermost one is kept (e.g. a card
`<div>` with a pointer cursor wrapping a real `<button>` collapses to
just the button).

The list is capped at **200 elements**, in document order. If the page
has more than that, you'll see `"truncated": true` — the model only sees
the first 200 and should do its best with what's there.

**Important:** because this is a live-DOM scan, real attributes and
labels ARE available now — `id`, `type`, `placeholder`, `aria-label`,
associated `<label>` text. Nothing needs to be inferred or guessed the
way it did under the old HTML-stripping pipeline.

## Input format sent to the model

Each element becomes one line, in document order:

```
{index} <{tag}[ type="..."][ disabled]>[ "visible text"][ label="..."][ placeholder="..."][ aria="..."][ options="a, b, c"]
```

Only the fields that exist for that element are present — most lines are
short. Real example, captured from an actual "create repository" style
form:

```
0 <a type="link"> "Home"
1 <a type="link"> "Repositories"
2 <a type="link"> "Settings"
3 <div> aria="Account menu"
4 <input type="text"> label="Repository name *" placeholder="my-awesome-project"
5 <textarea> label="Description" placeholder="Short description (optional)"
6 <select> "Public Private Internal" options="Public, Private, Internal"
7 <input type="checkbox"> label="Initialize this repository with a README"
8 <button type="button"> aria="More options"
9 <button type="button"> "Cancel"
10 <button type="submit" disabled> "Create repository"
```

This is what actually arrives in the request body:

```
POST /api/generate-tutorial
Content-Type: application/json

{
  "elements": "0 <a type=\"link\"> \"Home\"\n1 <a type=\"link\"> \"Repositories\"\n...",
  "user_goal": "help me create a new repository"
}
```

`elements` is the plain-text block above as a single string (already
newline-joined) — not JSON, not HTML. Don't reformat it, don't wrap it,
just read it as a numbered list.

## Output format

**Must be valid JSON, no markdown fences, no prose before or after:**

```
{
  "tutorial_code": [ /* page 1 steps */ [ ... ], /* page 2 steps */ [ ... ], ... ]
}
```

`tutorial_code` is an array of **pages**. Each page is an array of
**step** objects, in the order they should be shown. A single-page task
is still `[[step, step, step]]` — one page, still nested. If nothing on
the page can accomplish the goal, return `{"tutorial_code": []}` —
don't invent an element index that isn't in the input list.

## Step object schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `elementIndex` | integer | **yes** | Must be one of the index numbers from the input list, on **this** page. The extension resolves this to a real selector locally — you never write a selector yourself, so there's no XPath/CSS syntax to get right or wrong here. |
| `instruction` | string | **yes** | Shown to the user, typed out character by character. Plain, short, imperative ("Click Create repository to finish"). No markdown. |
| `action` | string | recommended | One of: `click`, `input`, `dropdown`, `scroll`, `select`, `hover`, `type`, `drag`. Controls which icon shows next to the instruction. Anything else silently falls back to a generic icon — always pick the closest match, don't invent new values. |
| `will_change_page` | boolean | conditional | `true` only on the **last step of a page**, only when that action is expected to navigate to a new page/route the tutorial continues on. See page-turn rule below. |
| `conclude_tutorial` | boolean | conditional | `true` only on the **very last step of the very last page** — the single step that ends the whole tutorial. Must appear exactly once across the entire output. |
| `offsetX`, `offsetY` | number | no | Pixel tweak for tooltip placement. Omit — defaults are fine for almost everything. |

There is no `wont_change_page` in the current schema — drop it if you
recall it from an earlier version of this doc; it isn't wired to any
behavior in the extension.

### Structural rules (validate these, they are not optional)

- Every page except the last must end with exactly one step that has
  `will_change_page: true`. No earlier step in a page should have it —
  the extension assumes the page-turning action is always the final
  step, and uses that assumption to detect if the user clicked the wrong
  thing (a "digression" toast fires otherwise).
- Exactly one step in the entire output — the last step of the last page
  — has `conclude_tutorial: true`. No other step should have it.
- `tutorial_code.length` (page count) must equal
  `1 + (number of will_change_page steps)`. If these disagree the
  extension's page/navigation bookkeeping goes out of sync.
- Every `elementIndex` must be one of the indices actually present in
  the given input for that page. The model has no knowledge of what the
  next page looks like — elements are only extracted for the page the
  user is currently on, so steps on page 2+ can't reference real indices
  yet. Keep page 2+ instructions goal-oriented ("Click Submit to finish
  creating the repository") rather than over-specific about exact
  layout, since they get inserted after the real navigation happens,
  sight-unseen, per current architecture. (If your setup can re-run
  extraction after each real page load and feed the model page 2's
  actual element list before generating those steps, that's better than
  guessing — flag if you want the contract extended to a multi-turn
  per-page-load flow instead of a single upfront call.)

## Worked example

Given the element list shown above and `user_goal`:
`"help me create a new repository"`, a correct response:

```json
{
  "tutorial_code": [
    [
      {
        "elementIndex": 4,
        "instruction": "Give your repository a name.",
        "action": "type"
      },
      {
        "elementIndex": 6,
        "instruction": "Choose who can see this repository.",
        "action": "dropdown"
      },
      {
        "elementIndex": 10,
        "instruction": "Click Create repository to finish.",
        "action": "click",
        "conclude_tutorial": true
      }
    ]
  ]
}
```

Note step 3 targets index 10 even though that button is currently
`disabled` in the input — that's fine, the tutorial plays out as the
user fills the form, and the button is expected to become enabled by
then. Don't avoid disabled elements on principle; just don't make them
the very next click if there's no step before it that would enable them.

## Guidance specific to a 7B model

Switching from "invent an XPath" to "pick a number from the list you
were given" removes the highest-risk failure mode from the old contract
(a 7B model doing DOM sibling-counting arithmetic correctly). What's
left to get right is smaller, but still worth constraining rather than
hoping for:

1. **Constrain decoding, don't just prompt for JSON.** Use a JSON
   schema / grammar (GBNF if you're on llama.cpp, `outlines` or
   `Instructor` if you're on Python/HF, or Mistral's native JSON mode if
   your endpoint supports it) built from the schema table above. This
   eliminates malformed JSON as a failure mode entirely.
2. **Validate `elementIndex` server-side before trusting it** — it's now
   a trivial check (is this integer present in the input list?) instead
   of the DOM-evaluation round trip the old selector-based contract
   needed. Reject/retry if the model references an index that wasn't in
   the input.
3. **Few-shot with real extracted lists**, not hand-typed ones. Run
   `getInteractiveElements()` against real pages you care about
   (settings forms, signup flows, dashboards) and use that actual output
   in your examples — include at least one multi-page example so the
   `will_change_page` rule is demonstrated, not just described.
4. **If you go the LoRA/fine-tune route**, training pairs should be
   `{"input": "<elements text>\n\nGoal: ...", "output": "{\"tutorial_code\": [...]}"}`
   JSONL, generated from real extractor output so the distribution
   matches production exactly — do not hand-write "clean" element lists
   for training examples.
5. **Validate the structural rules programmatically** (page count vs.
   `will_change_page` count, exactly one `conclude_tutorial`) before
   ever sending a response back to the extension — treat these as a
   hard gate, not a training aspiration.

## Quick checklist for a response to be acceptable

- [ ] Valid JSON, top-level key is exactly `tutorial_code`, no other text
- [ ] `tutorial_code` is an array of arrays (pages of steps), never flat
- [ ] Every `elementIndex` exists in the input list given for that page
- [ ] Every step has `instruction`; most have `action` from the closed set
- [ ] `will_change_page: true` appears only as the last step of a
      non-final page, once per page transition
- [ ] `conclude_tutorial: true` appears exactly once, on the true last step
- [ ] Page count == 1 + number of `will_change_page` steps
