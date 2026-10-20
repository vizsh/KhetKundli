"""Copy three pomegranate test photos (never used in training) into the app as Scan Lens samples.

Uses the same stratified split as train_pomegranate.py, so the samples are from its test set.
    ml/.venv/Scripts/python ml/scanlens/samples.py
"""
import json
from pathlib import Path

from PIL import Image
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "ml" / "data" / "pomegranate-288"
OUT = ROOT / "web" / "public" / "samples"
SEED = 7
PICK = {"Bacterial_Blight": "Pomegranate fruit, bacterial blight", "Anthracnose": "Pomegranate fruit, anthracnose", "Healthy": "Pomegranate fruit, healthy"}
CREDIT = "Pakruddin & Hemavathy 2024, CC BY 4.0; a test photo the model never trained on"
SOURCE = "https://doi.org/10.17632/b6s2rkpmvh.1"


def main() -> None:
    paths = sorted(CACHE.rglob("*.jpg"), key=lambda p: p.name)
    labels = [p.parent.name for p in paths]
    names = sorted(set(labels))
    y = [names.index(l) for l in labels]
    # The training script enumerates the parquet rows in order; file names are the row numbers.
    order = sorted(range(len(paths)), key=lambda i: int(paths[i].stem))
    paths = [paths[i] for i in order]
    y = [y[i] for i in order]
    import numpy as np
    idx = np.arange(len(paths))
    _, rest = train_test_split(idx, test_size=0.30, stratify=y, random_state=SEED)
    _, te = train_test_split(rest, test_size=0.50, stratify=[y[i] for i in rest], random_state=SEED)
    samples_file = OUT / "samples.json"
    samples = [s for s in json.loads(samples_file.read_text(encoding="utf-8")) if s.get("crop") != "pomegranate"]
    for cls, label in PICK.items():
        pick = next(paths[i] for i in te if paths[i].parent.name == cls)
        name = f"pom-{cls.lower().replace('_', '-')}.jpg"
        im = Image.open(pick).convert("RGB")
        k = 512 / min(im.size)
        im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.BICUBIC).save(OUT / name, quality=88)
        samples.append({"file": f"/samples/{name}", "crop": "pomegranate", "label": label, "credit": CREDIT, "source": SOURCE})
        print(name, "from", pick.name)
    samples_file.write_text(json.dumps(samples, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
