#!/usr/bin/env bash
# A side-by-side video of the phone and its TV (the Simulator's external display), framed and
# labelled, with a title card of the run's timings and one short clip per milestone:
#   recordings/<stamp>/kite-run.mp4, recordings/<stamp>/clips/NN-<milestone>.mp4
# Run after e2e/sim.sh (it reuses that build and simulator): pnpm e2e:record. Needs ffmpeg.
set -euo pipefail
export LANG="${LANG:-en_US.UTF-8}" LC_ALL="${LC_ALL:-en_US.UTF-8}"
here="$(cd "$(dirname "$0")" && pwd)"; app="$here/.."; cd "$app"
dev="${DEVICE:-__OGS_APP_ID__-sim}"; maestro="${MAESTRO:-$HOME/.maestro/bin/maestro}"
udid="$(xcrun simctl list devices | grep "$dev (" | grep -oE '[0-9A-F-]{36}' | head -1)"
stamp="$(date +%Y%m%d-%H%M%S)"; rec="$app/../recordings/$stamp"; raw="$rec/raw"; mkdir -p "$raw" "$rec/clips"
font="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
ms() { python3 -c 'import time; print(int(time.time()*1000))'; }

# Off then on: after a simulator reboot the menu can show 1080p checked with no display attached.
"$here/external-display.sh" "$dev" "Disabled" >/dev/null; sleep 1
"$here/external-display.sh" "$dev" "1920×1080 (1080p)" >/dev/null; sleep 2
# One host recording at a time (simctl): the TV is a real video, the phone a fast screenshot loop.
xcrun simctl io "$udid" recordVideo --codec=h264 --force --display=external "$raw/tv.mov" 2>"$raw/tv.log" &
tv_pid=$!
until grep -q "Recording started" "$raw/tv.log" 2>/dev/null; do sleep 0.1; done
t0=$(ms)
mkdir -p "$raw/phone"; touch "$raw/phone.on"
# Whatever happens (a Maestro step fails), stop both recorders: simctl allows one host recording.
trap 'rm -f "$raw/phone.on"; kill -INT "$tv_pid" 2>/dev/null || true' EXIT
( while [ -f "$raw/phone.on" ]; do
    xcrun simctl io "$udid" screenshot "$raw/phone/$(( $(ms) - t0 )).png" >/dev/null 2>&1 || true
    sleep 0.15
  done ) &
phone_pid=$!
marks="$raw/marks.txt"; : > "$marks"
mark() { echo "$(( $(ms) - t0 )) $1" >> "$marks"; }

mark "join-and-show-on-tv"
"$maestro" --device "$udid" test e2e/maestro/show-on-tv.yaml >"$raw/maestro-show.log" 2>&1
mark "tv-lobby"; sleep 3
mark "start-to-kites"
"$maestro" --device "$udid" test e2e/maestro/start.yaml >"$raw/maestro-start.log" 2>&1
mark "kites-question-reveal"
"$maestro" --device "$udid" test e2e/maestro/play.yaml >"$raw/maestro-play.log" 2>&1
mark "round-two"; sleep 4
mark "end"
rm -f "$raw/phone.on"; wait "$phone_pid" 2>/dev/null || true
kill -INT "$tv_pid"; wait "$tv_pid" 2>/dev/null || true

# The phone's screenshots as a video on the TV's clock (each frame held until the next).
python3 - "$raw/phone" > "$raw/phone.txt" <<'PY'
import os, sys
d = sys.argv[1]
shots = sorted(int(f[:-4]) for f in os.listdir(d) if f.endswith(".png"))
for i, t in enumerate(shots):
    nxt = shots[i + 1] if i + 1 < len(shots) else t + 200
    print(f"file '{d}/{t}.png'\nduration {(nxt - t) / 1000:.3f}")
print(f"file '{d}/{shots[-1]}.png'")
PY
first=$(ls "$raw/phone" | sed 's/.png//' | sort -n | head -1)
ffmpeg -y -loglevel error -f concat -safe 0 -i "$raw/phone.txt" -vf "fps=30,format=yuv420p" -c:v libx264 "$raw/phone.mp4"
offset=$(python3 -c "print($first/1000)")
label() { echo "drawtext=fontfile='$font':text='$1':fontcolor=white:fontsize=34:x=(w-text_w)/2:y=24"; }
ffmpeg -y -loglevel error -itsoffset "$offset" -i "$raw/phone.mp4" -i "$raw/tv.mov" -filter_complex "
  color=c=0x101522:s=2560x1240:r=30[bg];
  [0:v]fps=30,scale=-2:1000,pad=iw+16:ih+16:8:8:color=0xF5F1E6[ph];
  [1:v]fps=30,scale=1800:-2,setsar=1,pad=iw+16:ih+16:8:8:color=0xF5F1E6[tv];
  [bg][ph]overlay=40:150:eof_action=repeat[a];
  [a][tv]overlay=640:150:shortest=1[b];
  [b]$(label 'Phone (the app, host)    |    TV (the Simulator external display, AirPlay)')[out]" \
  -map "[out]" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 22 "$raw/side.mp4"

# A title card: the run from create to TV (e2e/out/timings.txt and ../timings.txt when present).
card_text="$(cat "$app/../timings.txt" "$here/out/timings.txt" 2>/dev/null | sed 's/  sim: //' | grep -E '[0-9]+s \(total' | head -14 | sed "s/'//g; s/:/\\\\:/g")"
printf '%s\n' "__OGS_APP_NAME__: create to TV" "" "$card_text" > "$raw/card.txt"
ffmpeg -y -loglevel error -f lavfi -i color=c=0x101522:s=2560x1240:d=5:r=30 \
  -vf "drawtext=fontfile='$font':textfile='$raw/card.txt':fontcolor=white:fontsize=40:line_spacing=14:x=160:y=140" \
  -c:v libx264 -pix_fmt yuv420p "$raw/card.mp4"
printf "file '%s'\nfile '%s'\n" "$raw/card.mp4" "$raw/side.mp4" > "$raw/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$raw/list.txt" -c copy "$rec/__OGS_APP_ID__-run.mp4"

# One clip per milestone, from the side-by-side video.
n=0; prev=""; while read -r at name; do
  if [ -n "$prev" ]; then
    read -r pat pname <<<"$prev"; n=$((n+1))
    dur=$(python3 -c "print(max(1,($at-$pat)/1000))")
    ffmpeg -y -loglevel error -ss "$(python3 -c "print($pat/1000)")" -t "$dur" -i "$raw/side.mp4" -c:v libx264 -pix_fmt yuv420p "$rec/clips/$(printf %02d $n)-$pname.mp4"
  fi
  prev="$at $name"
done < "$marks"
echo "$rec/__OGS_APP_ID__-run.mp4"
ls "$rec/clips"
