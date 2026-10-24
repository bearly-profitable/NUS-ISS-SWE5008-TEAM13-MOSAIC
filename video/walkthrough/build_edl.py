"""
Builds the walkthrough's edit decision list from the narration transcripts.

    python walkthrough/build_edl.py          ->  src/walkthrough/data/edl.json

Inputs (walkthrough/data/, made by transcribe.py): transcript.json (the
hotword-primed pass, used for the subtitles), transcript-alt.json (a plain
pass, which fills the odd line the primed pass dropped) and vad.json (Silero
speech regions). Speech is the union of all three, so a word missed by both
transcripts is still never cut.

Every word the presenter speaks is kept (padded so no syllable is clipped);
pauses between phrases are tightened to a beat; long silent stretches are
either dropped (nothing happening on screen) or kept as a short fast-forward
(something worth seeing happens: a loader, typing, a page building). The
decision for each long silence is made by hand in FAST_FORWARD below; the rule
for everything else is mechanical.

All times in this file are seconds of the *source* recording. The output is in
whole frames: `segs` (source range, speed, position in the cut), `chapters`
(cut frame each chapter starts on) and `cues` (subtitle lines, cut frames).
"""
import json
import math
import re
from pathlib import Path

FPS = 30
SRC_W, SRC_H = 2838, 1428

PRE, POST = 0.08, 0.20  # padding around speech
KEEP_PAUSE = 0.30  # gaps between padded phrases up to this long stay; longer ones are cut
MAX_WORD = 1.1  # whisper occasionally stretches a word over a silence

# Silences that become a fast-forward instead of a cut: (any time inside the gap, why).
FAST_FORWARD = [
    (16.0, "loading 1,000 contacts"),
    (48.0, "typing the campaign intent"),
    (60.0, "adding the Early Bird offer"),
    (82.0, "adding the flash-sale offer"),
    (160.0, "building segments"),
    (258.0, "writing creative direction"),
    (340.0, "composing six emails"),
    (480.0, "sending"),
    (503.0, "reading the email"),
]
FF_OUT = (1.3, 2.4)  # output length of a fast-forward, seconds

# Chapter starts (any time inside the silence before the chapter's first line).
CHAPTERS = [
    ("company", 0.0),
    ("segments", 109.1),
    ("creative", 205.0),
    ("emails", 290.9),
    ("guardian", 418.95),
    ("dispatch", 473.4),
    ("logs", 508.3),
]

# Privacy blur windows, source frames [from, to). Rects are kept sharp.
PRIVACY = [
    (6386, 6482, "picker", []),
    (6536, 6611, "picker", []),
    (14680, 14985, "inbox", [[600, 300, 2190, 80]]),
    (14985, 15166, "inbox-open", [[40, 110, 2020, 1140]]),
    (15166, 15187, "inbox", []),
]

# Subtitle fixes: whisper mishears product names and on-screen labels.
# (regex over the lower-cased word sequence, replacement words)
FIXES = [
    (r"\bmosaic\b|\bnosiac\b", "MOSAIC"),
    (r"\bfatcat\b", "fat cat"),
    (r"\bfcs\.com\.sg\b", "FCS.com.sg"),
    (r"\bthe birds\b", "the Early Bird"),
    (r"\bhttp scan\b|\bhdb scan\b|\bhdbscan\b", "HDBSCAN"),
    (r"\blom\b", "LLM"),
    (r"\bspares\b", "spend"),
    (r"\bblogs\b", "blocks"),
    (r"\bcode ins\b", "accordion"),
    (r"\bhearing niche\b", "hero image"),
    (r"\bcall of action\b", "call to action"),
    (r"\bchoose your beetle\b", "Choose Your Pillow"),
    (r"\bfrequent food price buyer\b", "Frequent Full-Price Buyer"),
    (r"\bseasonal gift buy\b", "Seasonal Gift Buyer"),
    (r"\bthat each attribute\b", "that the age attribute"),
    (r"\bembate\b", "embed"),
    (r"\bpaper personalized\b|\bhyper personalized\b", "hyper-personalized"),
]

# Lines break at sentence ends, at pauses, and before they get too long to read.
CUE_MAX_CHARS = 48
CUE_MAX_GAP = 0.6


DATA = Path(__file__).resolve().parent / "data"


def load_words(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    words = []
    for seg in data["segments"]:
        for w in seg["words"]:
            text = w["word"].strip()
            if not text:
                continue
            # Whisper splits hyphenated words and domains ("Full" "-Price", "fcs" ".com"); glue the tail back on.
            if words and (re.match(r"[-.]\w", text) or re.fullmatch(r"[^\w]+", text)):
                words[-1]["text"] += text
                words[-1]["end"] = max(words[-1]["end"], w["end"])
                continue
            start, end = w["start"], min(w["end"], w["start"] + MAX_WORD)
            words.append({"text": text, "start": start, "end": end})
    words.sort(key=lambda w: w["start"])
    return words


def merge_words(primary, alt, reach=0.3):
    """The primary transcript, plus any alt word with nothing from the primary pass anywhere near it."""
    extra = [w for w in alt if not any(p["start"] - reach < w["end"] and p["end"] + reach > w["start"] for p in primary)]
    for w in extra:
        print(f"  + {w['start']:7.2f} {w['text']}  (from the alt pass)")
    return sorted(primary + extra, key=lambda w: w["start"])


def apply_fixes(words):
    """Rewrite misheard phrases, re-timing the replacement words across the span they replace."""
    for pattern, repl in FIXES:
        rx = re.compile(pattern)
        i = 0
        while i < len(words):
            matched = False
            for n in (4, 3, 2, 1):
                if i + n > len(words):
                    continue
                span = words[i:i + n]
                raw = " ".join(w["text"] for w in span)
                bare = re.sub(r"[^\w\s.%-]", "", raw.lower()).strip(" .")
                m = rx.fullmatch(bare)
                if not m:
                    continue
                trail = re.search(r"[,.?!]+$", raw)
                new = repl.split(" ")
                t0, t1 = span[0]["start"], span[-1]["end"]
                step = (t1 - t0) / len(new)
                repl_words = [{"text": t, "start": t0 + k * step, "end": t0 + (k + 1) * step} for k, t in enumerate(new)]
                if trail:
                    repl_words[-1]["text"] += trail.group(0)
                words[i:i + n] = repl_words
                i += len(repl_words)
                matched = True
                break
            if not matched:
                i += 1
    return words


def speech_islands(spans):
    islands = []
    for a, b in sorted(spans):
        a, b = a - PRE, b + POST
        if islands and a - islands[-1][1] <= KEEP_PAUSE:
            islands[-1][1] = max(islands[-1][1], b)
        else:
            islands.append([max(0.0, a), b])
    return islands


def build_segments(islands, duration):
    segs = []
    for k, (a, b) in enumerate(islands):
        segs.append({"srcIn": round(a * FPS), "srcOut": round(b * FPS), "speed": 1, "kind": "talk"})
        if k + 1 == len(islands):
            break
        g0, g1 = b, islands[k + 1][0]
        why = next((w for t, w in FAST_FORWARD if g0 < t < g1), None)
        if why:
            frames_in = round(g1 * FPS) - round(g0 * FPS)
            out_len = min(FF_OUT[1], max(FF_OUT[0], (g1 - g0) / 6))
            frames_out = max(1, round(out_len * FPS))
            segs.append({"srcIn": round(g0 * FPS), "srcOut": round(g1 * FPS), "speed": frames_in / frames_out,
                         "kind": "ff", "why": why, "outFrames": frames_out})
    # The last island may run past the end of the recording.
    segs[-1]["srcOut"] = min(segs[-1]["srcOut"], int(duration * FPS))
    return segs


def split_privacy(segs):
    """Cut segments at privacy-window edges so each piece needs one blur setting."""
    out = []
    for s in segs:
        edges = sorted({e for p in PRIVACY for e in p[:2] if s["srcIn"] < e < s["srcOut"]})
        bounds = [s["srcIn"], *edges, s["srcOut"]]
        for a, b in zip(bounds, bounds[1:]):
            piece = dict(s, srcIn=a, srcOut=b)
            if s["kind"] == "ff":
                piece["outFrames"] = max(1, round((b - a) / s["speed"]))
            out.append(piece)
    for s in out:
        s["privacy"] = None
        for a, b, kind, rects in PRIVACY:
            if s["srcIn"] >= a and s["srcOut"] <= b:
                s["privacy"] = {"kind": kind, "keep": rects}
    return out


def place(segs):
    cut = 0
    for s in segs:
        s["frames"] = s.pop("outFrames", None) or (s["srcOut"] - s["srcIn"])
        s["speed"] = round((s["srcOut"] - s["srcIn"]) / s["frames"], 4)
        s["cutIn"] = cut
        cut += s["frames"]
    return cut


def src_to_cut(segs, sec):
    f = sec * FPS
    for s in segs:
        if f < s["srcIn"]:
            return s["cutIn"]
        if f < s["srcOut"]:
            return s["cutIn"] + (f - s["srcIn"]) / s["speed"]
    return segs[-1]["cutIn"] + segs[-1]["frames"]


def line_len(ws):
    return len(" ".join(w["text"] for w in ws))


def balance(phrase):
    """Split a phrase too long for one line into the fewest near-equal lines, preferring breaks after commas."""
    n = math.ceil(line_len(phrase) / CUE_MAX_CHARS)
    if n <= 1:
        return [phrase]
    target = line_len(phrase) / n
    best = {}

    def solve(i, k):
        # Best split of phrase[i:] into k lines: (cost, [line end indices]).
        if (i, k) in best:
            return best[(i, k)]
        if k == 1:
            ln = line_len(phrase[i:])
            res = ((ln - target) ** 2 + (1e6 if ln > CUE_MAX_CHARS + 6 else 0), [len(phrase)])
        else:
            res = (math.inf, [])
            for j in range(i + 1, len(phrase) - k + 2):
                ln = line_len(phrase[i:j])
                if ln > CUE_MAX_CHARS + 6:
                    break
                bonus = 140 if phrase[j - 1]["text"].endswith(",") else 0
                cost, ends = solve(j, k - 1)
                cost += (ln - target) ** 2 - bonus
                if cost < res[0]:
                    res = (cost, [j, *ends])
        best[(i, k)] = res
        return res

    ends = solve(0, n)[1]
    return [phrase[a:b] for a, b in zip([0, *ends], ends)]


def build_cues(words, segs, chapter_cuts):
    # Phrases end at sentence ends, at pauses that survive the cut, and at chapter cuts;
    # long phrases are then balanced into lines.
    phrases, cur = [], []
    for w in words:
        w = dict(w, **{"from": src_to_cut(segs, w["start"]), "to": src_to_cut(segs, w["end"])})
        if cur and ((w["from"] - cur[-1]["to"]) / FPS > CUE_MAX_GAP or re.search(r"[.?!]$", cur[-1]["text"])
                    or any(cur[0]["from"] < c <= w["from"] for c in chapter_cuts)):
            phrases.append(cur)
            cur = []
        cur.append(w)
    if cur:
        phrases.append(cur)
    out = []
    for line in (ln for p in phrases for ln in balance(p)):
        ws = [{"text": w["text"], "from": round(w["from"], 2), "to": round(w["to"], 2)} for w in line]
        # Drop the trailing comma of a line; keep sentence-ending punctuation.
        ws[-1]["text"] = re.sub(r",$", "", ws[-1]["text"])
        out.append({"from": ws[0]["from"], "to": ws[-1]["to"], "words": ws})
    return out


def main():
    duration = json.loads((DATA / "transcript.json").read_text(encoding="utf-8"))["duration"]
    primary, alt = load_words(DATA / "transcript.json"), load_words(DATA / "transcript-alt.json")
    vad = json.loads((DATA / "vad.json").read_text(encoding="utf-8"))
    words = apply_fixes(merge_words(primary, alt))
    spans = [(w["start"], w["end"]) for w in primary + alt] + [tuple(r) for r in vad]
    segs = split_privacy(build_segments(speech_islands(spans), duration))
    total = place(segs)
    chapters = [{"id": cid, "cutFrom": round(src_to_cut(segs, t))} for cid, t in CHAPTERS]
    cues = build_cues(words, segs, [c["cutFrom"] for c in chapters])
    out = {"fps": FPS, "srcW": SRC_W, "srcH": SRC_H, "cutTotal": total, "segs": segs, "chapters": chapters, "cues": cues}
    dest = Path(__file__).resolve().parent.parent / "src" / "walkthrough" / "data" / "edl.json"
    dest.write_text(json.dumps(out, indent=1), encoding="utf-8")
    talk = sum(s["frames"] for s in segs if s["kind"] == "talk")
    ff = [s for s in segs if s["kind"] == "ff"]
    print(f"{len(segs)} segments, cut = {total / FPS:.1f}s (talk {talk / FPS:.1f}s, {len(ff)} fast-forward pieces "
          f"{sum(s['frames'] for s in ff) / FPS:.1f}s), {len(cues)} cues -> {dest}")


if __name__ == "__main__":
    main()
