// Generates every voiceover clip from voiceover/*.md using the ElevenLabs API.
//
//   ELEVEN_API_KEY=xxxx ELEVEN_VOICE_ID=yyyy npm run voice
//
// Options:
//   --dry              parse and list the clips, call nothing
//   --video pitch      only one video (pitch | teaser | demo)
//   --only hook        only one scene id
//   --force            overwrite clips that already exist (default: skip, saves credits)
//
// Output: public/voice/<video>/<scene-id>.mp3
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);

const MODEL = process.env.ELEVEN_MODEL || "eleven_multilingual_v2";
const SETTINGS = {
  pitch: { stability: 0.5, similarity_boost: 0.8, style: 0.2 },   // warm, confident
  teaser: { stability: 0.35, similarity_boost: 0.8, style: 0.4 }, // upbeat, quick
  demo: { stability: 0.65, similarity_boost: 0.8, style: 0.1 },   // calm, instructional
};

/** Read the markdown table: first cell = scene id, a cell like "10s" = length, last cell = script. */
function parse(video) {
  const lines = readFileSync(join(root, "voiceover", `${video}.md`), "utf8").split("\n");
  const clips = [];
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    const id = cells[0];
    if (!/^[a-zA-Z]+$/.test(id) || id.toLowerCase() === "scene") continue;
    const lenCell = cells.find((c) => /^\d+(\.\d+)?s$/.test(c));
    clips.push({ video, id, seconds: lenCell ? parseFloat(lenCell) : undefined, text: cells[cells.length - 1] });
  }
  return clips;
}

async function speak(clip, key, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: clip.text, model_id: MODEL, voice_settings: SETTINGS[clip.video] }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

const videos = opt("video") ? [opt("video")] : ["pitch", "teaser", "demo"];
const clips = videos.flatMap(parse).filter((c) => !opt("only") || c.id === opt("only"));
const chars = clips.reduce((a, c) => a + c.text.length, 0);
console.log(`${clips.length} clips, ${chars} characters`);

if (flag("dry")) {
  for (const c of clips) console.log(`  ${c.video}/${c.id}.mp3  (${c.seconds ?? "?"}s)  ${c.text.slice(0, 60)}…`);
  process.exit(0);
}

const key = process.env.ELEVEN_API_KEY;
const voiceId = process.env.ELEVEN_VOICE_ID;
if (!key || !voiceId) {
  console.error("Set ELEVEN_API_KEY and ELEVEN_VOICE_ID first (see README).");
  process.exit(1);
}

for (const c of clips) {
  const dir = join(root, "public", "voice", c.video);
  const file = join(dir, `${c.id}.mp3`);
  mkdirSync(dir, { recursive: true });
  if (existsSync(file) && !flag("force")) {
    console.log(`skip   ${c.video}/${c.id}.mp3 (exists)`);
    continue;
  }
  try {
    writeFileSync(file, await speak(c, key, voiceId));
    const estSeconds = statSync(file).size / 16000; // 128 kbps MP3
    const long = c.seconds && estSeconds > c.seconds - 0.4;
    console.log(`ok     ${c.video}/${c.id}.mp3  ~${estSeconds.toFixed(1)}s of ${c.seconds ?? "?"}s${long ? "  ⚠ too long: raise this scene in TIMELINES" : ""}`);
  } catch (e) {
    console.error(`FAILED ${c.video}/${c.id}: ${e.message}`);
  }
}
