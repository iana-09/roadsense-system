import json


class GPSMatcher:

    EDGE_TOLERANCE_SECONDS = 10
    MAX_INTERPOLATION_GAP_SECONDS = 10

    def __init__(self, gps_trace_path, video_fps=30):
        self.video_fps = video_fps or 30
        self.gps_data = self._load_gps_trace(gps_trace_path)

    def _load_gps_trace(self, gps_trace_path):
        with open(gps_trace_path, 'r') as f:
            data = json.load(f)

        gps_points = data.get('gps_points') or data.get('locations') or []
        gps_points = [
            point for point in gps_points
            if point.get('timestamp') is not None
            and point.get('latitude') is not None
            and point.get('longitude') is not None
        ]
        gps_points.sort(key=lambda point: float(point['timestamp']))

        if gps_points:
            first_timestamp = float(gps_points[0]['timestamp'])
            last_timestamp = float(gps_points[-1]['timestamp'])
            trace_duration = last_timestamp - first_timestamp

            # Mobile GPS often arrives as device-clock/epoch seconds. Detections
            # are video-relative seconds, so normalize obvious absolute traces.
            if first_timestamp > 60 and trace_duration < 24 * 60 * 60:
                for point in gps_points:
                    point['original_timestamp'] = point['timestamp']
                    point['timestamp'] = float(point['timestamp']) - first_timestamp
                print(f" Normalized GPS timestamps by subtracting first timestamp ({first_timestamp}).")
            elif first_timestamp > 0 and trace_duration > 0:
                # Some phone traces are already relative seconds, but start when
                # GPS capture begins instead of when the video starts. Align
                # those traces to video time so early detections are not lost.
                for point in gps_points:
                    point['original_timestamp'] = point['timestamp']
                    point['timestamp'] = float(point['timestamp']) - first_timestamp
                print(f" Normalized GPS timestamps by subtracting relative offset ({first_timestamp}).")
            else:
                for point in gps_points:
                    point['timestamp'] = float(point['timestamp'])

        print(f" Loaded GPS trace with {len(gps_points)} points.")
        return {'gps_points': gps_points}

    def _gps_payload(self, point, timestamp, frame_number, interpolated=False, nearest_timestamp=None):
        payload = {
            'latitude': point['latitude'],
            'longitude': point['longitude'],
            'accuracy': point.get('accuracy'),
            'timestamp': timestamp,
            'frame_number': frame_number,
            'interpolated': interpolated,
        }
        if nearest_timestamp is not None:
            payload['nearest_gps_timestamp'] = nearest_timestamp
        return payload

    def _interpolate_gps(self, frame_number):
        if frame_number is None:
            print("WARNING: Detection has no frame number; cannot match GPS.")
            return None

        timestamp = frame_number / self.video_fps
        gps_points = self.gps_data['gps_points']

        if not gps_points:
            print("WARNING: GPS trace is empty.")
            return None

        first_ts = gps_points[0]['timestamp']
        last_ts = gps_points[-1]['timestamp']

        # Clamp to edges if the detection is close to the GPS coverage window.
        if timestamp < first_ts:
            if abs(first_ts - timestamp) <= self.EDGE_TOLERANCE_SECONDS:
                return self._gps_payload(gps_points[0], timestamp, frame_number,
                                         nearest_timestamp=first_ts)
            print(f"WARNING: No GPS data for frame {frame_number} (timestamp {timestamp:.2f}s)")
            return None

        if timestamp > last_ts:
            if abs(timestamp - last_ts) <= self.EDGE_TOLERANCE_SECONDS:
                return self._gps_payload(gps_points[-1], timestamp, frame_number,
                                         nearest_timestamp=last_ts)
            print(f"WARNING: No GPS data for frame {frame_number} (timestamp {timestamp:.2f}s)")
            return None

        # Find the two surrounding points using binary search style
        before = None
        after = None

        for i in range(len(gps_points) - 1):
            curr = gps_points[i]
            nxt = gps_points[i + 1]

            if curr['timestamp'] <= timestamp <= nxt['timestamp']:
                before = curr
                after = nxt
                break

        # Exact match
        if before and before['timestamp'] == timestamp:
            return self._gps_payload(before, timestamp, frame_number)

        if before is None or after is None:
            # Fallback: nearest point within tolerance.
            nearest = min(gps_points, key=lambda p: abs(p['timestamp'] - timestamp))
            if abs(nearest['timestamp'] - timestamp) <= self.EDGE_TOLERANCE_SECONDS:
                return self._gps_payload(nearest, timestamp, frame_number,
                                         nearest_timestamp=nearest['timestamp'])
            print(f"WARNING: No GPS data for frame {frame_number} (timestamp {timestamp:.2f}s)")
            return None

        # Linear interpolation
        time_diff = after['timestamp'] - before['timestamp']
        if time_diff > self.MAX_INTERPOLATION_GAP_SECONDS:
            nearest = min((before, after), key=lambda p: abs(p['timestamp'] - timestamp))
            if abs(nearest['timestamp'] - timestamp) <= self.EDGE_TOLERANCE_SECONDS:
                return self._gps_payload(nearest, timestamp, frame_number,
                                         nearest_timestamp=nearest['timestamp'])

            print(f"WARNING: No GPS data for frame {frame_number} (timestamp {timestamp:.2f}s)")
            return None

        weight = 0 if time_diff == 0 else (timestamp - before['timestamp']) / time_diff

        accuracy = None
        if before.get('accuracy') is not None and after.get('accuracy') is not None:
            accuracy = before['accuracy'] + weight * (after['accuracy'] - before['accuracy'])
        elif before.get('accuracy') is not None:
            accuracy = before['accuracy']
        elif after.get('accuracy') is not None:
            accuracy = after['accuracy']

        return self._gps_payload(
            {
                'latitude': before['latitude'] + weight * (after['latitude'] - before['latitude']),
                'longitude': before['longitude'] + weight * (after['longitude'] - before['longitude']),
                'accuracy': accuracy,
            },
            timestamp,
            frame_number,
            interpolated=True,
        )

    def match_detections(self, detections):
        matched_detections = []
        print(f"\n Matching {len(detections)} detections with GPS coordinates...")

        for detection in detections:
            frame_number = detection.get('first_seen_frame') or detection.get('frame_number')
            gps = self._interpolate_gps(frame_number)

            if gps:
                detection['gps'] = gps
                detection['gps_match_status'] = 'matched'
            else:
                # Keep the detection but mark it clearly
                detection['gps'] = None
                detection['gps_match_status'] = 'missing'
                print(f"  Warning: Frame {frame_number} - no GPS match, detection kept without coordinates")

            matched_detections.append(detection)

        gps_count   = sum(1 for d in matched_detections if d.get('gps'))
        no_gps_count = len(matched_detections) - gps_count
        print(f" Matched {gps_count}/{len(matched_detections)} detections with GPS.")
        if no_gps_count:
            print(f" Warning: {no_gps_count} detections have no GPS - they will be skipped by web server.")

        return matched_detections
