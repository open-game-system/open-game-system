"""
Finds how far the TV recording lags the phone recording by matching picture content: the phone's
on-screen TV page (a crop of the Simulator recording) against the TV's video, both shrunk to 64x36
grayscale at 4 fps, over offsets from -20 s to +20 s. Prints the offset (seconds to add to the TV
clip's start so the two line up) and the match error.

  python3 -I align.py phone.mp4 tv.webm [crop_y crop_h]
"""
import subprocess
import sys

import numpy as np

FPS = 4
W, H = 64, 36


def frames(path, vf):
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", path, "-vf", f"{vf}fps={FPS},scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32)


phone, tv = sys.argv[1], sys.argv[2]
# The spike app draws the TV page at the top of the screen: y = 80 pt, height = width * 720/1280.
cy = int(sys.argv[3]) if len(sys.argv) > 3 else 240
ch = int(sys.argv[4]) if len(sys.argv) > 4 else 678
p = frames(phone, f"crop=iw:{ch}:0:{cy},")
t = frames(tv, "")
# Ignore frames with no picture (black / white) on either side.
def ok(a):
    m = a.mean(axis=(1, 2))
    return (m > 20) & (m < 235)

best = None
for off in np.arange(-20, 20.01, 0.25):
    k = int(round(off * FPS))  # tv frame i lines up with phone frame i + k
    idx = [(i, i + k) for i in range(len(t)) if 0 <= i + k < len(p)]
    idx = [(i, j) for i, j in idx if ok(t[i:i + 1])[0] and ok(p[j:j + 1])[0]]
    if len(idx) < 40:
        continue
    err = float(np.mean([np.abs(t[i] - p[j]).mean() for i, j in idx]))
    if best is None or err < best[1]:
        best = (off, err, len(idx))
print(f"{best[0]:.2f} {best[1]:.1f} {best[2]}")
