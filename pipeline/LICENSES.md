# Dependency licenses

Fonts: `assets/fonts/font-0.ttf` is DM Sans (`assets/fonts/DM-Sans-LICENSE.txt`) and `assets/newsreader.ttf` is Newsreader (`assets/Newsreader-OFL.txt`), both for the share cards. The site and the explainer videos use the site's self-hosted fonts in `public/fonts/`.

All runtime dependencies are open source. One paid service is optional: the explainer's scene plan (Claude Haiku through the Batch API, `ANTHROPIC_API_KEY`, about $1 a month or less); without a key the plans are made by rules. Versions are those
installed when this was written (license text taken from each package's own metadata).

## Direct

| Package | Version | License | Use |
|---|---|---|---|
| feedparser | 6.0.12 | BSD-2-Clause | RSS/Atom parsing |
| httpx | 0.28.1 | BSD-3-Clause | HTTP client |
| PyYAML | 6.0.3 | MIT | config files |
| anthropic | 2.8.0 | Apache-2.0 | the explainer's scene plan (Message Batches API) |
| Pillow | 13.0.0 | HPND | share cards, card pictures, the explainer gate, portrait tracing |
| pytest (dev only) | 8.4.2 | MIT | tests |

Everything else is the Python standard library (sqlite3, xml.etree, html.parser, urllib.robotparser).

## Transitive (runtime)

| Package | License |
|---|---|
| httpcore | BSD-3-Clause |
| h11 | MIT |
| anyio | MIT |
| idna | BSD-3-Clause |
| certifi | **MPL-2.0** (file-level copyleft; fine to use unmodified as a dependency) |
| sgmllib3k (via feedparser) | BSD |
| typing_extensions | PSF-2.0 (Python < 3.11 only) |
| exceptiongroup | MIT (Python < 3.11 only) |
| sniffio | MIT OR Apache-2.0 (per upstream; metadata was not installed here, re-check) |

Dev-only transitives (pytest): iniconfig MIT, pluggy MIT, packaging Apache-2.0 OR BSD-2-Clause,
pygments BSD-2-Clause, tomli MIT.

Not verified: licenses of newer versions pulled by a fresh `pip install` on the VPS. Re-run
`pip-licenses` (or read each package's metadata) after upgrading.

## Phase 2a (optional, external programs; not in requirements.txt)

| Tool | Licence | Notes |
|---|---|---|
| piper-tts 1.8.0 | **GPL-3.0-or-later** | installed in its own venv, run as a subprocess |
| Piper voice en_US-lessac-medium | check model card | per-voice licence, not verified here |
| ffmpeg / ffprobe | LGPL-2.1+ or GPL (build dependent) | used as a subprocess; use an LGPL build |
| libx264 (inside ffmpeg) | GPL-2.0+ | subprocess; needed for H.264 MP4 output |
| Kokoro-82M + kokoro-onnx (voice, optional) | Apache-2.0 / MIT per upstream (package metadata was blank; re-check) | `tts_kokoro.py`, needs Python >= 3.10 |
| potrace | GPL-2.0-or-later | a separate program, run as a subprocess to trace portraits (`explainer portrait add`) |
| Explainer drawings, templates, themes, music bed | original, made in code for Bought | no third-party artwork or audio |
| Explainer portraits (`pipeline/explainer/library/portraits/`) | each its photo's licence (public domain, CC0, CC BY, CC BY-SA) | source, author and licence in each `<slug>.json`; credited on the frame |

## backend/ (browser and server, npm)

| Package | License | Used for |
| --- | --- | --- |
| `@supabase/supabase-js` | MIT | Sign-in and database |
| `tsx` | MIT | Runs the TypeScript server |

## Site fonts and production tools

| Item | License | Used for |
| --- | --- | --- |
| Fraunces, Newsreader, Geist, Geist Mono (`public/fonts/`) | SIL OFL 1.1 | The site's type, self-hosted copies of the Google Fonts files |
| `playwright-core` (root `package.json`) | Apache-2.0 | Drives headless Chromium to render the explainer videos |
| Chromium (installed by Playwright) | BSD-3-Clause and others | The renderer's browser |
| Caddy | Apache-2.0 | HTTPS and static files on the VPS |
| ctranslate2, sentencepiece (models venv) | MIT, Apache-2.0 | Running the translation model |
