# Benchmark promo videos (Remotion)

Three videos from one codebase:

| Command | Output | Format | Length |
|---|---|---|---|
| `npm run render:pitch`  | out/benchmark-pitch-16x9.mp4  | 16:9 | ~86s (competitions, investors, schools) |
| `npm run render:teaser` | out/benchmark-teaser-9x16.mp4 | 9:16 | ~30s (WhatsApp status, Instagram, TikTok) |
| `npm run render:demo`   | out/benchmark-demo-16x9.mp4   | 16:9 | ~71s (step-by-step product walkthrough) |
| `npm run render:all`    | all three | | first run downloads Chrome |

## Run it
1. `npm install`
2. `npm run dev` opens Remotion Studio in the browser. Pick Pitch, Teaser or Demo and scrub the timeline.
3. Change copy, prices, contact details, timings in `src/config.ts`. Every scene is in `src/scenes/`.
4. `npm run render:all`

## Add music
1. Download a track (Pixabay Music or Mixkit, see notes in chat), rename it `music.mp3`, drop it in `public/`.
2. In `src/config.ts` set `HAS_MUSIC = true`. It fades in, loops, and fades out automatically.

## Add the voice (female)
1. Open `voiceover/pitch.md` (also `teaser.md`, `demo.md`). Generate each line as its own clip.
2. Save as `public/voice/<video>/<scene-id>.mp3`, e.g. `public/voice/pitch/hook.mp3`.
3. In `src/config.ts` set `HAS_VOICE = { pitch: true, ... }` for that video.
4. If a clip runs longer than its scene, raise that scene's seconds in `TIMELINES`. All animation stretches to fit.

## Notes
- `ONLINE_PAYMENTS_LIVE = false` labels the Nomba scene "Coming soon". Flip it to true once online payments work.
- Prices (₦500 per student, ₦15,000 minimum) are the app's placeholders. Edit `DEMO` in `src/config.ts`.
- Mock UIs reuse the app's real colors, Inter font, receipt format (BMK-2026-00001) and email wording.

## Generate all voice clips in one command
```
# Mac/Linux
ELEVEN_API_KEY=your_key ELEVEN_VOICE_ID=your_female_voice_id npm run voice
# Windows PowerShell
$env:ELEVEN_API_KEY="your_key"; $env:ELEVEN_VOICE_ID="your_voice_id"; npm run voice
```
`npm run voice -- --dry` lists the clips without calling anything. Add `--video pitch`, `--only hook` or `--force` as needed.
It writes `public/voice/<video>/<scene-id>.mp3` and warns if a clip is longer than its scene. Then set `HAS_VOICE` in `src/config.ts`.
