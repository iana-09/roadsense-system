import os

from roboflow import Roboflow

rf = Roboflow(api_key=os.environ["ROBOFLOW_API_KEY"])

project = rf.workspace("roadsense-premium-trial-060526").project("roadsense2-premium")

version = project.version(1)

version.deploy(
    model_type="yolov8",
    model_path="runs/detect/train-2/weights",
    filename="best.pt"
)

print("Done")
