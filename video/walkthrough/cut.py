"""
Renders the jump-cut source the composition plays, from src/walkthrough/data/edl.json.

    python walkthrough/cut.py <source.mp4> [ffmpeg]

  public/walkthrough/cut.mp4    picture only, every EDL segment back to back at native
                                resolution, fast-forwards retimed, privacy windows blurred,
                                a keyframe every second so the renderer seeks cheaply
  public/walkthrough/voice.wav  the narration on the same clock: talk segments with 6 ms
                                fades at every splice, silence under fast-forwards, then
                                cleaned (rumble cut, denoise, gentle compression, -14 LUFS)

Segments are encoded in parallel and joined with the concat demuxer (no re-encode).
"""
import json
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
EDL = json.loads((ROOT / "src" / "walkthrough" / "data" / "edl.json").read_text(encoding="utf-8"))
OUT = ROOT / "public" / "walkthrough"
FPS, SR = EDL["fps"], 48000
SPF = SR // FPS  # audio samples per frame

ENCODE = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-g", str(FPS), "-pix_fmt", "yuv420p", "-an"]
VOICE_CHAIN = ("highpass=f=80,lowpass=f=13000,afftdn=nr=10:nf=-50:tn=1,"
               "acompressor=threshold=-22dB:ratio=2.5:attack=8:release=120:makeup=2,"
               "loudnorm=I=-14:TP=-1.5:LRA=9")


def blur_graph(keep):
    """Blur the whole frame, then lay the sharp `keep` rects back on top."""
    g = f"[0:v]split={len(keep) + 1}[b]" + "".join(f"[k{i}]" for i in range(len(keep)))
    g += ";[b]boxblur=luma_radius=48:luma_power=3[bl]"
    last = "bl"
    for i, (x, y, w, h) in enumerate(keep):
        g += f";[k{i}]crop={w}:{h}:{x}:{y}[c{i}];[{last}][c{i}]overlay={x}:{y}[v{i}]"
        last = f"v{i}"
    return g, last


def encode(args):
    i, seg, src, ff, tmp = args
    dest = Path(tmp) / f"seg_{i:04d}.mp4"
    start = max(0.0, (seg["srcIn"] - 0.5) / FPS)
    graph, last = ("[0:v]null[raw]", "raw")
    if seg["privacy"]:
        graph, last = blur_graph(seg["privacy"]["keep"])
    if seg["kind"] == "ff":
        graph += f";[{last}]setpts=(PTS-STARTPTS)/{seg['speed']},fps={FPS}[out]"
    else:
        graph += f";[{last}]setpts=PTS-STARTPTS[out]"
    cmd = [ff, "-v", "error", "-y", "-ss", f"{start:.4f}", "-i", src, "-filter_complex", graph, "-map", "[out]",
           "-frames:v", str(seg["frames"]), "-r", str(FPS), *ENCODE, str(dest)]
    subprocess.run(cmd, check=True)
    return dest


def count_frames(ffprobe, path):
    out = subprocess.run([ffprobe, "-v", "error", "-select_streams", "v", "-count_packets", "-show_entries",
                          "stream=nb_read_packets", "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return int(out.stdout.strip())


def build_voice(src, ff):
    raw = subprocess.run([ff, "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    fade = int(0.006 * SR)
    ramp = np.linspace(0, 1, fade, dtype=np.float32)
    parts = []
    for seg in EDL["segs"]:
        n = seg["frames"] * SPF
        if seg["kind"] == "ff":
            parts.append(np.zeros(n, np.float32))
            continue
        a = seg["srcIn"] * SPF
        piece = np.zeros(n, np.float32)
        chunk = x[a:a + n]
        piece[:len(chunk)] = chunk
        piece[:fade] *= ramp
        piece[-fade:] *= ramp[::-1]
        parts.append(piece)
    y = np.concatenate(parts)
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as f:
        f.write(y.tobytes())
        rawpath = f.name
    subprocess.run([ff, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", rawpath,
                    "-af", VOICE_CHAIN, "-ar", str(SR), "-c:a", "pcm_s16le", str(OUT / "voice.wav")], check=True)
    Path(rawpath).unlink()
    return len(y) / SR


def default_ffmpeg():
    """A full ffmpeg build: the one imageio-ffmpeg ships if installed, else whatever is on PATH."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def main():
    src = sys.argv[1]
    ff = sys.argv[2] if len(sys.argv) > 2 else default_ffmpeg()
    ffprobe = str(Path(ff).with_name("ffprobe.exe")) if ff.endswith(".exe") and Path(ff).with_name("ffprobe.exe").exists() else "ffprobe"
    OUT.mkdir(parents=True, exist_ok=True)
    segs = EDL["segs"]
    with tempfile.TemporaryDirectory() as tmp:
        with ThreadPoolExecutor(max_workers=6) as pool:
            files = list(pool.map(encode, [(i, s, src, ff, tmp) for i, s in enumerate(segs)]))
        listing = Path(tmp) / "list.txt"
        listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in files), encoding="utf-8")
        subprocess.run([ff, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy",
                        "-movflags", "+faststart", str(OUT / "cut.mp4")], check=True)
    voice_s = build_voice(src, ff)
    try:
        n = count_frames(ffprobe, OUT / "cut.mp4")
        print(f"cut.mp4: {n} frames (EDL {EDL['cutTotal']}), voice.wav: {voice_s:.2f}s ({EDL['cutTotal'] / FPS:.2f}s expected)")
    except (ValueError, FileNotFoundError):
        print(f"cut.mp4 written; voice.wav {voice_s:.2f}s ({EDL['cutTotal'] / FPS:.2f}s expected)")


if __name__ == "__main__":
    main()
