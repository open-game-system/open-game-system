// Puts up to four recordings in one synced 2x2 video (1920x1080): node compose-2x2.mjs tiles.json out.mp4
// tiles.json: [{ file, label, at? (ms its first frame was recorded) | end? (ms its last frame was) }]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [tilesFile, out] = process.argv.slice(2);
const tiles = JSON.parse(readFileSync(tilesFile, "utf8"));
const seconds = (file) =>
  Number(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ])
      .toString()
      .trim(),
  );
for (const t of tiles) {
  t.length = seconds(t.file);
  if (t.at === undefined) t.at = t.end - t.length * 1000;
}
const t0 = Math.min(...tiles.map((t) => t.at));
const total = Math.max(...tiles.map((t) => (t.at - t0) / 1000 + t.length));
const font = "/System/Library/Fonts/Supplemental/Arial.ttf";
const chains = tiles.map(
  (t, i) =>
    `[${i}:v]tpad=start_duration=${((t.at - t0) / 1000).toFixed(3)}:color=0x120f22,scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2:color=0x120f22,fps=30,drawtext=fontfile=${font}:text='${t.label}':x=16:y=12:fontsize=26:fontcolor=white:box=1:boxcolor=0x000000AA:boxborderw=8[v${i}]`,
);
while (chains.length < 4) chains.push(`color=c=0x120f22:s=960x540:r=30[v${chains.length}]`);
const filter = `${chains.join(";")};[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[out]`;
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    ...tiles.flatMap((t) => ["-i", t.file]),
    "-t",
    total.toFixed(2),
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "27",
    out,
  ],
  { stdio: "inherit" },
);
console.log(`${out}: ${total.toFixed(1)} s, ${tiles.length} tiles`);
