from deep_sort_realtime.deepsort_tracker import DeepSort

class Tracker:
    def __init__(self):
        self.tracker = DeepSort(
            max_age=30,
            n_init=2,
            max_iou_distance=0.7
        )

    def update(self, detections, frame):
        """
        detections: list of dictionaries from YOLODetector.detect().
        """
        dets = []
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            conf = det.get("confidence", 0.0)
            class_name = det.get("class_name", "unknown")
            dets.append(([x1, y1, x2-x1, y2-y1], conf, class_name))

        tracks = self.tracker.update_tracks(dets, frame=frame)

        output = []

        for t in tracks:
            if not t.is_confirmed():
                continue

            track_id = t.track_id
            l, t_, w, h = t.to_ltwh()
            x1, y1, x2, y2 = l, t_, l+w, t_+h

            # Find the class corresponding to this track using IoU.
            class_name = "unknown"
            confidence = 0.0
            for det in dets:
                bx, conf, cname = det
                if self.bbox_iou([x1, y1, x2, y2], [bx[0], bx[1], bx[0]+bx[2], bx[1]+bx[3]]) > 0.3:
                    class_name = cname
                    confidence = conf
                    break

            output.append({
                "track_id": track_id,
                "bbox": [x1, y1, x2, y2],
                "class_name": class_name,
                "confidence": confidence,
            })

        return output

    @staticmethod
    def bbox_iou(box1, box2):
        """Compute IoU of two boxes"""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])

        inter_area = max(0, x2-x1) * max(0, y2-y1)
        box1_area = (box1[2]-box1[0])*(box1[3]-box1[1])
        box2_area = (box2[2]-box2[0])*(box2[3]-box2[1])
        union_area = box1_area + box2_area - inter_area
        return inter_area / union_area if union_area > 0 else 0
