# MOSAIC — product demo video

A [Remotion](https://remotion.dev) project that renders the 60-second MOSAIC product demo,
cut to the beat of *Forward Motion*. Standalone: it has its own `package.json` and does not
share a build with `frontend/` or `backend/`. Design decisions, the storyboard and the music
analysis are in [SPEC.md](SPEC.md).

```bash
cd video
npm install
npm run studio        # preview + scrub in the Remotion Studio
npm run render        # -> out/mosaic-intro.mp4        (1920x1080, 30 fps, 60.0 s, with music)
npm run render:nobgm  # -> out/mosaic-intro-nobgm.mp4  (same cut, SFX only)
npm run still         # -> out/frame.png               (the closing lockup, for a poster)
```

## Where the screenshots come from

Every UI shot is the real Console. `capture/` drives `frontend/` (vite dev on :5173) with
Playwright and answers each Orchestrator call from `capture/fixture/*.json`, so no live backend
or Supabase project is needed:

```bash
cd backend && .venv/Scripts/python.exe ../video/capture/build_fixture.py   # rebuild the fixture
cd ../frontend && npm run dev                                              # in another shell
cd ../video && npm run capture                                             # -> public/ui/, src/ui-layout.json
```

`build_fixture.py` restates the FatCatPillow run's outputs (segments, copy, scores) and builds
everything structural with the backend's own code: email blocks from
`email_composer._build_blocks`, Guardian results from `guardian.run_checks`, CSV profiling from
`csv_ingest`, the rubric from `eval.rubric`. Textures are captured at 3× device scale.

## Structure

```
src/
  timeline.ts         beat grid + shot table — the one clock everything is written against
  MosaicIntro.tsx     shot order
  audio/Soundtrack    music + the SFX pin table (peak-lag and encoder-offset compensated)
  lib/                camera (2.5D PageCam), easing/blur/grain, text reveals
  components/         Shot (whip / flash seams), Caption, Cursor, MosaicMark, Background
  scenes/             Opening, Company, Segments, Breath, Creative, Compose, Guardian,
                      Ledger, EvalScore, Outro
capture/              fixture builder, Playwright capture, texture post-processing
analysis/             beat grid of the track, SFX peak lags
public/               ui/ textures, music/, sfx/ (Mixkit, see sfx/ATTRIBUTION-shotcraft.md)
```

To retime, edit `SHOTS` in `src/timeline.ts` in beats; SFX pins follow automatically.

## Notes

- Built with the [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) workflow
  (Apache-2.0); `src/lib/polish.tsx`, `text.tsx` and the camera math in `cam.tsx` are adapted
  from its fixtures.
- The rendered audio trails the picture by the AAC encoder's priming delay (2032 samples on this
  pipeline); `OUTPUT_AUDIO_OFFSET_SEC` in `timeline.ts` compensates. Re-measure it if the codec,
  sample rate or Remotion version changes.
- Fonts come from `@remotion/google-fonts`, so the first render needs a network connection.
