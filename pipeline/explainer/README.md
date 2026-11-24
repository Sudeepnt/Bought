# The explainer engine

Every story video is an explainer drawn by code: a source card, line drawings, a timeline, a big quote, a lower-third
caption and an end card. Nothing in a video is an AI picture. The approved design is
`bought-explainer-kit/reference/explainer-themes.html`; the library ports it.

```
 issue.json (the frozen top stories)
   |  plan      plan.py: ONE Claude Haiku call per story, through the Message Batches API (half price, overnight).
   |            The library's catalogue is a cached system prompt; the answer is JSON in a schema whose ids are enums
   |            from the library, so the model can only pick what exists. It writes the words; it draws nothing.
   |  check     plain code: every quote word for word in a source, every number / date / weekday / month and every
   |            person's name in the sources, every id and part in the library, 4-7 scenes, end card last.
   |            Fails -> sent back once with the errors. Fails again -> "needs review" on the desk, no video.
   |            No key, or the call fails -> the plan made by rules (headline as kinetic type, a drawing, the summary).
   |  theme     themes.py: the desk's choice, else the section's pool, the weekday edition first, never twice in a row.
   |  voice     voice.py: local Kokoro, one clip per narration line, so every line's length is exact. That sets each
   |            scene's length and each caption. A music bed made by code (pure tones, ours) ducks under the voice.
   |  render    render.cjs: headless Chromium, every CSS / Web / SVG animation paused and set to frame n x 1000/30 ms,
   |            each frame captured and piped to ffmpeg (H.264, -preset veryfast). Same plan, same frames.
   |  gate      sizes, codecs, sound, length matches the voice, poster not blank.
   v
 out/issues/<date>/explainers/<story id>/  9x16.mp4 16x9.mp4 9x16.jpg 16x9.jpg captions.vtt plan.json
   |  publish   R2: issues/<date>/explainers/<story id>/ (or the site's own folder without R2). The paper's video spots
   v            play the 16:9 file, the clips rail the 9:16 one. A story the desk held goes out without its video.
```

Heavy work runs at nice 19 / ionice idle (as every funnel job), and before each render it waits out the reader hours
or a busy machine, unless the issue is due within 3 hours (`desk.wait_quiet`).

## The library (`library/`)

| Part | Where | What |
| --- | --- | --- |
| Drawings | `objects/{tech,infra,business,people}.cjs` | 44 line drawings. Each has an id, tags, named parts that can be highlighted (`datacenter.zoneB`, `chip.core`, `phone.notification`), anchor points for arrows and labels. Only `--line`, `--acc` and tints of them: every theme recolours every drawing. |
| Scene templates | `scenes/{core,charts,world}.cjs` | 18 templates, each `(data, theme, ratio) => HTML` with a 9:16 and a real 16:9 layout (header across the top, card left and drawing right, caption as a lower third, horizontal timelines). Each declares its fields; the plan schema is built from them. |
| Themes | `themes/*.json` | The 20 approved themes as data: colour tokens, fonts (the site's self-hosted Fraunces, Newsreader, Geist, Geist Mono), a layout name per ratio and the theme's own CSS rules. |
| Portraits | `portraits/<slug>.svg` + `.json` | Line art traced from public-domain or CC BY / BY-SA photos, with source, author, licence and credit. Shown with the credit on the frame. |
| Shared CSS | `base.css` | The frame, the card, the caption, every template and drawing, ported from the reference. |
| Samples | `samples.cjs` | A short and a long version of every template: the desk's gallery and the overflow tests. |

`node cli.cjs catalogue` prints all of it as JSON (Python reads it through `library.py`).

## Portraits

```sh
python -m pipeline explainer portrait add photo.jpg --name "Jane Doe" --alias "J. Doe" \
  --source https://commons.wikimedia.org/wiki/File:Jane_Doe.jpg --author "A. Photographer" --license "CC BY-SA 4.0"
```

potrace (not AI) traces the photo at three darkness levels into a 2-3 tone drawing coloured by the theme. NC and ND
licences are refused (tracing is a change; the paper is a business), and so is anything not public domain or CC. Never
trace press or agency photos. Clean the SVG up by hand if needed. A person named in a story with no portrait gets an
initials avatar and goes on the desk's "Portraits needed" list.

## The desk

- `/admin/explainers`: this issue's explainers (plan source, theme, status, length, render time), portraits needed, and
  the gallery: every template (short and long text), every theme and every drawing, in either ratio and any theme.
- `/admin/explainers/story`: the plan, what the checks said, the videos, a live preview of every scene in both ratios,
  "Re-render with this theme", "Make it with the rules' plan", Approve and Hold. Re-rendering runs as a desk job at low
  priority; a live issue is published again.

## Commands

```sh
python -m pipeline explainer catalogue                       # counts
python -m pipeline explainer sample --theme map-room --out /tmp/x   # a sample video without the AI (timing a machine)
python -m pipeline explainer rerender --issue 2026-11-15 --story ID --theme orbit
```

## Keys and cost

`ANTHROPIC_API_KEY` in `/etc/bought/bought.env` (VPS) or `backend/.env` (Mac). Model: `explainer_model` in config
(`claude-haiku-5-5`, $0.10 / $0.50 per million tokens, half that through the Batch API). One request per story: the
catalogue system prompt (about 1,900 tokens, cached), the output schema (about 6,000 tokens), the story (under 500)
and 1,500-2,500 tokens out, thinking at low effort included. That is about $0.001 a story, so 5-10 videos a day comes
to roughly $0.15-0.35 a month, with retries. Well inside the $1-2 target. (Estimated from token counts by character
length; check the real `usage` in the first batches.)

## Tests

`pipeline/tests/test_explainer.py`: the library has everything, drawings have no fixed colours, the schema only allows
library ids, every template x theme x ratio with short and long text keeps every text inside its frame, the checks pass
the recorded plan and fail invented quotes / numbers / dates / names / ids, the retry and the rules' fallbacks, initials
and the portraits-needed list, a traced and credited portrait, theme choice, voice timing and captions, deterministic
frames (hashed), the desk, and one full run: source -> recorded Haiku answer -> voice -> render -> an R2 stand-in ->
publish -> the paper plays the video in Chromium. `fixtures/explainer/haiku_response.json` is a stand-in in the
Batch API's exact result shape; replace it with a real recording once a key is set.
