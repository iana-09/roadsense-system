import os
from pathlib import Path

import torch


ROOT = Path(__file__).resolve().parent


def resolve_model_path() -> Path:
    configured = os.getenv("ROADSENSE_MODEL_PATH")
    candidates = [
        Path(configured) if configured else None,
        ROOT / "GPU_Worker" / "models" / "best.pt",
        ROOT / "runs" / "detect" / "train-2" / "weights" / "best.pt",
        ROOT / "runs" / "train_final2" / "weights" / "best.pt",
        ROOT / "runs" / "train_batch2" / "weights" / "best.pt",
        ROOT / "GPU_Worker" / "yolov8n.pt",
    ]

    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate

    raise FileNotFoundError("No model weights found in the configured RoadSense search paths.")


model_path = resolve_model_path()
ckpt = torch.load(model_path, map_location="cpu", weights_only=False)
model = ckpt.get("model") if isinstance(ckpt, dict) else None
names = getattr(model, "names", None)
train_args = ckpt.get("train_args", {}) if isinstance(ckpt, dict) else {}

print(f"Model: {model_path}")
print(f"Names: {names}")
print(f"Train args: {train_args}")
