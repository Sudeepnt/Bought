# The funnel: source to video

jev is a cheap, quick decision model with one job: can we have this news, is it really for Bought, and which section. Everything else is plain rules,
and the same input gives the same result. The videos are explainers drawn by code (`pipeline/explainer/README.md`): Claude Haiku only picks
scenes from the library and writes the words, plain code checks every fact against the sources, and the voice engine (Kokoro) reads it out.

```
 1 brief.yaml         what news we want: keywords per section, section sizes, date window
 2 sources.live.yaml  where it comes from: curated (TLDR, Techmeme, Hacker News), then newsrooms
   |
   |  visit        titles and links, inside the date window. Sponsors and publisher-tagged "sponsored" posts skipped.
   |  unique       near-identical headlines: the stronger source wins
   |  on brief     rules drop promotions and anything matching no keyword, and file the rest by keyword
   v
 3 jev             gets the brief plus each story's title, link, source and date. Decides: keep or drop, rank, section.
   |               Without jev set, the rules' ranking (source strength + freshness) picks instead.
   |  select       fills the sections from brief.yaml (about 50), never padding one from another
   |  describe     for the final list only, opens each article page once: share picture and summary (robots.txt honoured)
   v
 issue.json        FROZEN once per date. Videos show rank, "up next" and a ticker in the picture, so the order cannot change later.
   |  explainers   the top funnel_video_count stories (pipeline/explainer/): plan (Claude Haiku, Batch API) -> check against
   |               the sources -> theme -> voice (Kokoro, one clip per line) -> render (Chromium + ffmpeg, 9:16 and 16:9,
   |               every frame set exactly) -> gate. A plan that fails its checks twice waits on the desk with no video
   v
 feed.json + explainers/   only stories whose explainer passed have a video
   |  publish      publish.py: clean text, lay out the paper, videos to R2 issues/<date>/explainers/<id>/ (or public/issues/<date>/),
   |               list the date in issues/index.json
   |  podcast      every story read aloud as one episode with chapters (Listen)
   |  translate    headlines and summaries for the language picker
   v
 the site          the issue is live after the first publish; audio and languages join it as they finish
```

Run from the project root, with the Python that has `requirements.txt` (node, ffmpeg and Chromium for the explainers):

```sh
python -m pipeline funnel run              # intake, freeze today's issue (IST), build the videos
python -m pipeline funnel run --issue 2026-11-03   # a past date: TLDR pages for that day, feeds cut off at that day
python -m pipeline funnel intake           # intake only: safe every 30 minutes
python -m pipeline funnel build --limit 3  # just the first 3 explainers
python -m pipeline funnel publish          # put the built issue on the site (safe to rerun)
python -m pipeline funnel podcast          # build the episode only, then publish
python -m pipeline funnel translate --langs hi-IN,kn   # these languages only, then publish
python -m pipeline funnel status           # where the stories went
python -m pipeline funnel schema           # the JSON a model must answer in
```

Working files: `pipeline/out/issues/<date>/`. `funnel run` does every step and publishes; `build` alone changes nothing on the site until `publish` runs.
Stop a build at any time and rerun it: finished stages are skipped, and a failed one is retried up to `media_max_attempts`.

## Pictures

Videos carry no photos: everything in them is drawn by code, and people are traced line portraits from public-domain or
CC BY / BY-SA photos, credited on the frame (`pipeline/explainer/README.md`). Cards still show the article's own share
picture, read from its page. Licensing is being handled separately: every issue writes `rights_review.json`, listing each
publisher picture used on a card and its article (`card_pictures`). To stop one publisher's pictures add
`image_rights: link_only` to its source; `funnel_publisher_images: false` stops them all.

## The desk (admin page)

`python -m pipeline serve` runs the site and `/admin`. Code: `pipeline/desk.py` (choices and stages), `pipeline/server.py` (web and clock), `pipeline/admin_pages.py`, `pipeline/mailer.py`. The editor's choices live in `data/desk.db`, so an intake can't undo them.

```
 review      the rules' ~50 are chosen; everything else on brief is left over. Ignore, Use today, Use tomorrow
 finalized   the list is fixed and shown for a last look. Back to review is still possible
 building    Publish clicked: `funnel prepare` makes videos and audio from exactly that list, then languages
 ready       waits for the publish time in Settings. Hold, or Publish now
 live        on the site; the email goes to confirmed subscribers, each logged so nobody gets it twice
```

Stories that ran are marked `used`, so a later issue can't run them again. A story held for tomorrow runs tomorrow even if it has aged out of the window.
The auction is still simulated, so going live depends only on the clock, not on bidding having closed.

## Languages

A language reaches the picker only if at least 90% of its headlines keep their numbers and are not just the English again. This
stopped Kannada on 2026-11-05: the offline translator (M2M100) wrote about unrelated events. It catches invented and copied text, not rough wording.

## Plugging in jev

Set `funnel_evaluator_command` in `config.yaml` to the program that runs jev. It reads `{contract_version, schema, brief,
candidates}` on stdin and prints `{"assessments": [...]}`. `funnel schema` prints the exact shape as JSON Schema.

```json
{"article_id": "…", "decision": "keep", "relevance": 0.8, "category": "AI", "reason": "for the log only"}
```

- **Its answer decides.** A dropped story is out; in each section the stories it rates highest run; its section stands.
- **It cannot write anything a reader sees.** There is no field for it. Headlines, scripts and pictures stay rule-made.
  Feeds are untrusted text, so a prompt injection in a headline can at worst get that one story wrongly in or out.
- **Strict parsing.** An unknown field, a wrong type, a value out of range, a made-up id or a skipped story rejects the batch.
  Nothing is repaired or guessed, and those stories keep the rules' result.
- **Saves calls.** Promotions and off-brief stories are never sent, and each answer is stored with its version and input hash
  in `assessments`, so a story is not asked twice. Bump `funnel_evaluator_version` to ask again.
