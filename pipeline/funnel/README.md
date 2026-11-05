# The funnel: source to video

jev is a cheap, quick decision model with one job: can we have this news, is it really for Bought, and which section. Everything else is plain rules,
and the same input gives the same result. The voice engine (Kokoro) is a neural model too, but it only reads out the script.

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
   |  images       publisher photo first, then free clips and photos; see below
   |  voice        script from the rules, read by Kokoro
   |  render       prime_render.cjs: 20 frame looks, Chromium + ffmpeg, credit on the picture
   |  gate         streams, 1280x720, video length matches voice, still frame not blank
   v
 feed.json + media/   only stories that passed the gate have a video
```

Run from the project root, with the Python that has `requirements.txt` and `requirements-media.txt`:

```sh
python -m pipeline funnel run              # intake, freeze today's issue (IST), build the videos
python -m pipeline funnel run --issue 2026-11-03   # a past date: TLDR pages for that day, feeds cut off at that day
python -m pipeline funnel intake           # intake only: safe every 30 minutes
python -m pipeline funnel build --limit 3  # just the first 3 videos
python -m pipeline funnel status           # where the stories went
python -m pipeline funnel schema           # the JSON a model must answer in
```

Output: `pipeline/out/issues/<date>/`. Nothing here changes what the site shows until those files are copied to `public/`.
Stop a build at any time and rerun it: finished stages are skipped, and a failed one is retried up to `media_max_attempts`.

## Pictures

Each picture carries its source and credit. Licensing is being handled separately: every issue writes `rights_review.json`,
listing each publisher picture used and its article. That list is the input for the legal work. To stop one publisher's
pictures add `image_rights: link_only` to its source; `funnel_publisher_images: false` stops them all.

1. **Publisher:** the article's own share picture, read from its page. Credited on screen as "Photo: <credit or site>".
2. **Free video clip** from Commons when one matches: six seconds cut into frames, no sound.
3. **Wikipedia article pictures,** then **Commons search,** to give the video more than one shot. Names come from the
   headline's capitalisation and Wikipedia must confirm each: "Palantir" passes; "Johnson" and "Boston" do not. Only allowed
   free licences, and the file must name the subject. Pages of white (tables, screenshots) are refused.
4. **House library** (`avatar_fallback_images`), only when nothing above was found.

If the Commons service is down the stage fails and is retried, so an outage cannot freeze a video full of stand-ins.

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
