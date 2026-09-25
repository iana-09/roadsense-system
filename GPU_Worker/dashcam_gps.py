"""
70mai GPS Atom Extractor
Reads the proprietary GPS track embedded in 70mai MP4 files.

70mai stores GPS in a 'free' or 'gps ' box inside the MP4 container.
Each record is 36 bytes:
  - 4 bytes: timestamp (uint32, seconds since epoch or relative)
  - 4 bytes: latitude  (float32, decimal degrees, negative = S)
  - 4 bytes: longitude (float32, decimal degrees, negative = W)
  - 4 bytes: speed     (float32, km/h)
  - 4 bytes: heading   (float32, degrees)
  - 16 bytes: padding / reserved

If the atom is not found, returns an empty list so the caller
can fall back to the phone GPS trace.
"""

import struct
from pathlib import Path


GPS_RECORD_SIZE = 36  # bytes per GPS record in 70mai atom
GPS_ATOM_NAMES  = [b'gps ', b'free', b'GPS ']  # box names to search


def _find_atom(data: bytes, name: bytes, start: int = 0) -> tuple[int, int]:
    """
    Scan `data` for an MP4 box with the given 4-byte name.
    Returns (offset_of_payload, payload_size) or (-1, 0) if not found.
    """
    i = start
    while i < len(data) - 8:
        size = struct.unpack_from('>I', data, i)[0]
        atom = data[i + 4: i + 8]

        if size < 8:
            break  # corrupt atom

        if atom == name:
            return i + 8, size - 8  # payload starts after the 8-byte header

        i += size

    return -1, 0


def extract_gps_from_70mai(video_path: str) -> list[dict]:
    """
    Extract GPS points from a 70mai MP4 file.

    Args:
        video_path: Path to the .mp4 file recorded by a 70mai dashcam.

    Returns:
        List of dicts with keys: timestamp, latitude, longitude, speed, heading.
        Empty list if no GPS atom found (caller should fall back to phone GPS).
    """
    path = Path(video_path)
    if not path.exists():
        print(f"[70mai GPS] File not found: {video_path}")
        return []

    # Read only the first 8 MB — GPS atom is always in the header area
    with open(path, 'rb') as f:
        header = f.read(8 * 1024 * 1024)

    gps_points = []

    for atom_name in GPS_ATOM_NAMES:
        offset, size = _find_atom(header, atom_name)
        if offset == -1 or size < GPS_RECORD_SIZE:
            continue

        payload = header[offset: offset + size]
        n_records = size // GPS_RECORD_SIZE

        print(f"[70mai GPS] Found '{atom_name.decode().strip()}' atom — {n_records} GPS records")

        for i in range(n_records):
            rec = payload[i * GPS_RECORD_SIZE: (i + 1) * GPS_RECORD_SIZE]
            if len(rec) < GPS_RECORD_SIZE:
                break
            try:
                ts, lat, lon, spd, hdg = struct.unpack_from('<IfFFf', rec, 0)
                # Skip zero/invalid records
                if lat == 0.0 and lon == 0.0:
                    continue
                gps_points.append({
                    'timestamp': float(ts),
                    'latitude':  round(float(lat), 6),
                    'longitude': round(float(lon), 6),
                    'speed':     round(float(spd), 2),
                    'heading':   round(float(hdg), 2),
                    'accuracy':  5.0,   # 70mai GPS is typically ~5m
                    'source':    '70mai_atom',
                })
            except struct.error:
                continue

        if gps_points:
            break  # found valid data, no need to check other atom names

    if not gps_points:
        print(f"[70mai GPS] No GPS atom found in {path.name} — caller should use phone GPS")

    return gps_points


def convert_to_gps_trace(gps_points: list[dict]) -> dict:
    """
    Wrap extracted points into the same { gps_points: [...] } format
    that the phone GPS trace uses, so GPSMatcher works unchanged.
    """
    return {'gps_points': gps_points}


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else 'test.mp4'
    points = extract_gps_from_70mai(path)
    print(f"Extracted {len(points)} GPS points")
    if points:
        print("First point:", points[0])
        print("Last point: ", points[-1])