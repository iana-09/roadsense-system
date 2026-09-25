import { API_BASE_URL as BASE_URL } from '../config';

async function readJson(res, fallback) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || fallback);
  return data;
}

export async function getPhilippineRegions() {
  const res = await fetch(`${BASE_URL}/api/locations/regions`);
  return readJson(res, 'Could not load Philippine regions.');
}

export async function getPhilippineCities(regionCode) {
  const params = new URLSearchParams({ region_code: regionCode });
  const res = await fetch(`${BASE_URL}/api/locations/cities?${params}`);
  return readJson(res, 'Could not load Philippine cities and municipalities.');
}

export async function getPhilippineBarangays(cityCode) {
  const res = await fetch(
    `${BASE_URL}/api/locations/cities/${encodeURIComponent(cityCode)}/barangays`,
  );
  return readJson(res, 'Could not load barangays for the selected locality.');
}
