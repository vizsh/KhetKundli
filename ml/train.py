"""Fine-tune the Scan Lens model on field photos and export it for the phone.

Data layout (one folder per class, any image names):
    ml/data/train/pomegranate_bacterial_blight/*.jpg
    ml/data/train/pomegranate_healthy/*.jpg
    ml/data/val/<same class folders>/*.jpg      # photos never used for training: this is the field accuracy

Run:
    python -m venv .venv && .venv/Scripts/activate   (Windows)   or   source .venv/bin/activate
    pip install -r ml/requirements.txt
    python ml/train.py --data ml/data --out web/public/models/pomegranate --epochs 8

Writes model_fp32.onnx (browser, ONNX Runtime Web), model_int8.onnx (mobile / Snapdragon NPU via
Qualcomm AI Hub), config.json (labels) and metrics.json (per-class field accuracy; report it, do not hide it).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from transformers import AutoModelForImageClassification

BASE = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"
MEAN = STD = [0.5, 0.5, 0.5]


def loaders(data: Path, batch: int):
    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(0.3, 0.3, 0.3, 0.05),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    val_tf = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    train = datasets.ImageFolder(data / "train", train_tf)
    val = datasets.ImageFolder(data / "val", val_tf)
    if train.classes != val.classes:
        raise SystemExit(f"train and val class folders differ: {train.classes} vs {val.classes}")
    return (
        DataLoader(train, batch_size=batch, shuffle=True, num_workers=2),
        DataLoader(val, batch_size=batch, num_workers=2),
        train.classes,
    )


@torch.no_grad()
def evaluate(model: nn.Module, val: DataLoader, classes: list[str], device: str):
    model.eval()
    correct = torch.zeros(len(classes))
    total = torch.zeros(len(classes))
    for x, y in val:
        pred = model(pixel_values=x.to(device)).logits.argmax(1).cpu()
        for t, p in zip(y, pred):
            total[t] += 1
            correct[t] += int(t == p)
    per_class = {c: (correct[i] / total[i]).item() if total[i] else None for i, c in enumerate(classes)}
    overall = (correct.sum() / total.sum()).item() if total.sum() else 0.0
    return overall, per_class, {c: int(total[i]) for i, c in enumerate(classes)}


def export(model: nn.Module, classes: list[str], out: Path, metrics: dict):
    out.mkdir(parents=True, exist_ok=True)
    model.eval().cpu()

    class Logits(nn.Module):
        def __init__(self, m: nn.Module):
            super().__init__()
            self.m = m

        def forward(self, pixel_values):
            return self.m(pixel_values=pixel_values).logits

    dummy = torch.randn(1, 3, 224, 224)
    fp32 = out / "model_fp32.onnx"
    torch.onnx.export(
        Logits(model), dummy, fp32,
        input_names=["pixel_values"], output_names=["logits"],
        dynamic_axes={"pixel_values": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )
    from onnxruntime.quantization import QuantType, quantize_dynamic

    quantize_dynamic(str(fp32), str(out / "model_int8.onnx"), weight_type=QuantType.QInt8)
    (out / "config.json").write_text(json.dumps({"id2label": {str(i): c for i, c in enumerate(classes)}}, indent=2))
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(f"wrote {fp32}, model_int8.onnx, config.json, metrics.json to {out}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", type=Path, default=Path("ml/data"))
    ap.add_argument("--out", type=Path, default=Path("web/public/models/pomegranate"))
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=1e-4)
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    train, val, classes = loaders(args.data, args.batch)
    model = AutoModelForImageClassification.from_pretrained(
        BASE,
        num_labels=len(classes),
        id2label=dict(enumerate(classes)),
        label2id={c: i for i, c in enumerate(classes)},
        ignore_mismatched_sizes=True,
    ).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    loss_fn = nn.CrossEntropyLoss()

    best, best_state = -1.0, None
    for epoch in range(1, args.epochs + 1):
        model.train()
        for x, y in train:
            opt.zero_grad()
            loss = loss_fn(model(pixel_values=x.to(device)).logits, y.to(device))
            loss.backward()
            opt.step()
        acc, per_class, counts = evaluate(model, val, classes, device)
        print(f"epoch {epoch}: field accuracy {acc:.3f} " + ", ".join(f"{c} {v:.2f}" for c, v in per_class.items() if v is not None))
        if acc > best:
            best, best_state = acc, {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    acc, per_class, counts = evaluate(model, val, classes, device)
    export(model, classes, args.out, {
        "base": BASE,
        "field_accuracy": acc,
        "per_class": per_class,
        "val_images_per_class": counts,
        "note": "Accuracy on held-out field photos (ml/data/val). Report it alongside the base model's 95% lab accuracy.",
    })


if __name__ == "__main__":
    main()
