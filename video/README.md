# MOSAIC — product intro video

A [Remotion](https://remotion.dev) project that renders the MOSAIC Campaign
Console's product intro. Standalone: it has its own `package.json` and does not
share a build with `frontend/` or `backend/`.

```bash
cd video
npm install
npm run studio     # preview + scrub in the Remotion Studio
npm run render     # -> out/mosaic-intro.mp4   (1920x1080, 30fps, ~58s)
npm run render:sting  # -> out/mosaic-sting.mp4 (the 5s logo lockup on its own)
npm run still      # -> out/frame.png          (a single frame, for thumbnails)
```

## What it shows

Ten scenes, in the order the console itself works:

| # | Scene | Source of truth |
|---|---|---|
| 1 | The problem — one email for everyone | — |
| 2 | Logo build | `frontend/public/mosaic_logo_cropped.png` |
| 3 | The five-tab pipeline and its unlock rule | `frontend/src/lib/pipeline.ts`, `App.tsx` |
| 4 | Segmentation: HDBSCAN, noise, held-out protected attributes | `backend/app/orchestrator/agents/segmentation.py` |
| 5 | Creative Director: the four direction fields + palette | `backend/app/orchestrator/state.py` |
| 6 | Composition: typed slots, 20 block types, offer citations | `frontend/src/types/email-builder.ts`, `agents/email_composer.py` |
| 7 | Guardian: nine checks, three groups, severity → verdict | `backend/app/orchestrator/agents/guardian.py` |
| 8 | Human approval + the append-only ledger | `backend/app/ledger.py`, `mailer.py` |
| 9 | Sidecar eval scorecard | `backend/app/eval/rubric.py` |
| 10 | Outro lockup | — |

Numbers on screen (segment sizes, scores, timings) are one illustrative run, not
live data. Everything structural — stage names, check names, field names, rubric
weights, model ids — is taken from the code and should be updated here when it
changes there.

## Structure

```
src/
  index.ts            registerRoot
  Root.tsx            compositions: MosaicIntro, LogoSting
  MosaicIntro.tsx     the scene table — durations live here
  theme.ts            colours and fonts, mirrored from frontend/src/index.css
  anim.ts             shared easing/entrance helpers
  components/
    Background.tsx    the console's .gradient-mesh, slowly drifting
    MosaicMark.tsx    the logo rebuilt as eight animatable vector tiles
    Ui.tsx            Card / Title / Sub / Chip / SceneHead primitives
  scenes/S01…S10      one file per scene, each taking its own `length`
```

To retime the film, edit the `duration` values in `SCENES` (`src/MosaicIntro.tsx`)
— each scene fades itself in and out against one continuous background, so the
cuts stay dissolves whatever the lengths are.

## Notes

- There is no audio track. Drop a music bed in with `<Audio src={staticFile(...)}/>`
  in `MosaicIntro.tsx` if one is wanted.
- Fonts come from `@remotion/google-fonts` (Inter + JetBrains Mono), restricted
  to the latin subset and the weights actually used — rendering pulls them at
  render time, so the first render needs a network connection.
