"""
Transcribes the walkthrough narration with word timings, twice, plus a speech map.

    python walkthrough/transcribe.py <source.mp4> <faster-whisper model dir or name> [ffmpeg]

  data/transcript.json      primed with the product's vocabulary (hotwords), used for subtitles
  data/transcript-alt.json  unprimed; the primed pass occasionally drops a whole line
  data/vad.json             Silero speech regions, so cutting never relies on the transcripts alone

CPU int8 is fine: medium.en takes about five minutes per pass on this recording.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel
from faster_whisper.vad import VadOptions, get_speech_timestamps

DATA = Path(__file__).resolve().parent / "data"


def default_ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"
SR = 16000
VOCAB = ("MOSAIC, Fat Cat Company, FCS.com.sg, fat cat pillows, early birds, flash sales, dynamic attribute, newsletter opt-in, "
         "average discount, HDBSCAN, feature matrix, segment briefs, Seasonal Gift Buyers, Frequent Full-Price Buyers, Creative Review, "
         "hero image, brand palette, Email Review, accordion, countdown, coupon, blocks, call to action, Choose Your Pillow, "
         "Guardian agent, model scores, protected attribute, dispatch, delivery history, logs, LLM")


def words_json(segments, info):
    return {"duration": info.duration, "segments": [
        {"start": s.start, "end": s.end, "text": s.text,
         "words": [{"start": w.start, "end": w.end, "word": w.word, "p": w.probability} for w in (s.words or [])]}
        for s in segments]}


def main():
    src, model_name = sys.argv[1], sys.argv[2]
    ff = sys.argv[3] if len(sys.argv) > 3 else default_ffmpeg()
    raw = subprocess.run([ff, "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.float32)
    DATA.mkdir(exist_ok=True)

    vad = get_speech_timestamps(audio, VadOptions(threshold=0.4, min_silence_duration_ms=250, speech_pad_ms=0, min_speech_duration_ms=120))
    (DATA / "vad.json").write_text(json.dumps([[t["start"] / SR, t["end"] / SR] for t in vad]), encoding="utf-8")

    model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=16)
    common = dict(language="en", word_timestamps=True, beam_size=5, vad_filter=True,
                  vad_parameters=dict(min_silence_duration_ms=400, speech_pad_ms=200), condition_on_previous_text=True)
    segs, info = model.transcribe(audio, initial_prompt=f"Hi everyone, today I'm going to do a short walkthrough on MOSAIC. {VOCAB}.",
                                  hotwords=VOCAB, **common)
    (DATA / "transcript.json").write_text(json.dumps(words_json(list(segs), info), indent=1), encoding="utf-8")
    segs, info = model.transcribe(audio, initial_prompt="MOSAIC campaign console.", **common)
    (DATA / "transcript-alt.json").write_text(json.dumps(words_json(list(segs), info), indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
