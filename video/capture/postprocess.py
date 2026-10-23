"""
Turns capture.mjs output into film textures: full pages → high-quality JPEG
(cropped to what the camera ever sees), email cut-outs trimmed to the email
itself. Updates src/ui-layout.json (pageH, email box) to match.

    python capture/postprocess.py
"""
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
UI = HERE.parent / "public" / "ui"
LAYOUT = HERE.parent / "src" / "ui-layout.json"
L = json.loads(LAYOUT.read_text())

# CSS height the camera can reach on each page (None = keep all).
CROP = {"company": 1500, "creative": 2300}
PAGES = ["company", "segments", "segments-empty", "creative", "emails", "approvals", "approvals-loyal",
         "approvals-view", "approvals-gift", "approvals-gift-sent", "editor", "logs", "logs-sent"]
DROP = ["eval", "email-discount", "email-loyal"]  # only their cut-outs are used

for name in PAGES:
    src = UI / f"{name}.png"
    if not src.exists():
        continue
    dpr = L[name].get("dpr", 2)
    im = Image.open(src).convert("RGB")
    if CROP.get(name):
        im = im.crop((0, 0, im.width, CROP[name] * dpr))
        L[name]["pageH"] = CROP[name]
    im.save(UI / f"{name}.jpg", quality=96, subsampling=0)
    src.unlink()
    print(name, im.size)

for name in DROP:
    (UI / f"{name}.png").unlink(missing_ok=True)

# Email cut-outs: trim to the email card (background #FFF8F0 around it).
for key in ["email-discount", "email-loyal"]:
    path = UI / f"{key}@full.png"
    dpr = L[key].get("dpr", 3)
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(int)
    h, w, _ = a.shape
    d = np.abs(a - np.array([255, 248, 240])).sum(axis=2) > 18
    inner = d[60:h - 120, 60:w - 60]
    cols = np.where(inner.sum(axis=0) > 5)[0]
    x0, x1 = cols.min() + 60, cols.max() + 60
    rows = np.where(inner.sum(axis=1) > 5)[0] + 60
    end = rows[0]
    for y in rows:  # end of the first contiguous block (gap > 300 px ends it)
        if y - end > 300:
            break
        end = y
    pad = 25 * dpr
    box = (max(0, x0 - pad), 0, min(w, x1 + pad), min(h, end + pad))
    out = im.crop(box)
    out.save(path)
    L[key]["email"] = {"w": out.width / dpr, "h": out.height / dpr, "bodyX": (x0 - box[0]) / dpr, "bodyW": (x1 - x0) / dpr}
    print(key, out.size)

LAYOUT.write_text(json.dumps(L, indent=1))
