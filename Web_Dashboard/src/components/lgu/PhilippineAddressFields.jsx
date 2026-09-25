import { useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import {
  getPhilippineBarangays,
  getPhilippineCities,
  getPhilippineRegions,
} from '../../api/locations.api';

const selectClass = [
  'w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-3 py-3',
  'text-sm text-white outline-none transition-colors',
  'focus:border-teal-500/70 disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

export default function PhilippineAddressFields({
  regionCode,
  cityCode,
  barangayCode,
  onRegionChange,
  onCityChange,
  onBarangayChange,
  error,
}) {
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [barangaysCityCode, setBarangaysCityCode] = useState('');
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [citiesRegionCode, setCitiesRegionCode] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    getPhilippineRegions()
      .then((data) => {
        if (active) setRegions(data.regions || []);
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError.message);
      })
      .finally(() => {
        if (active) setLoadingRegions(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!regionCode) {
      setCities([]);
      setCitiesRegionCode('');
      return () => { active = false; };
    }

    getPhilippineCities(regionCode)
      .then((data) => {
        if (active) {
          setCities(data.cities || []);
          setCitiesRegionCode(regionCode);
          setLoadError('');
        }
      })
      .catch((requestError) => {
        if (active) {
          setCitiesRegionCode(regionCode);
          setLoadError(requestError.message);
        }
      });
    return () => { active = false; };
  }, [regionCode]);

  useEffect(() => {
    let active = true;
    if (!cityCode) {
      return () => { active = false; };
    }

    getPhilippineBarangays(cityCode)
      .then((data) => {
        if (active) {
          setBarangays(data.barangays || []);
          setBarangaysCityCode(cityCode);
          setLoadError('');
        }
      })
      .catch((requestError) => {
        if (active) {
          setBarangaysCityCode(cityCode);
          setLoadError(requestError.message);
        }
      });
    return () => { active = false; };
  }, [cityCode]);

  const selectRegion = (event) => {
    const code = event.target.value;
    onRegionChange(regions.find((item) => item.code === code) || null);
    onCityChange(null);
    onBarangayChange(null);
  };

  const selectCity = (event) => {
    const code = event.target.value;
    onCityChange(cities.find((item) => item.code === code) || null);
    onBarangayChange(null);
  };

  const selectBarangay = (event) => {
    const code = event.target.value;
    onBarangayChange(barangays.find((item) => item.code === code) || null);
  };
  const visibleBarangays = cityCode === barangaysCityCode ? barangays : [];
  const visibleCities = regionCode === citiesRegionCode ? cities : [];
  const loadingCities = Boolean(regionCode && citiesRegionCode !== regionCode);
  const loadingBarangays = Boolean(cityCode && barangaysCityCode !== cityCode);

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-sm font-medium text-slate-300">LGU Address</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-xs text-slate-400">Region</span>
          <div className="relative">
            <select className={selectClass} value={regionCode} onChange={selectRegion} disabled={loadingRegions}>
              <option value="">{loadingRegions ? 'Loading regions...' : 'Select region'}</option>
              {regions.map((region) => (
                <option key={region.code} value={region.code}>{region.name}</option>
              ))}
            </select>
            {loadingRegions && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-slate-400" />}
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs text-slate-400">City / Municipality</span>
          <div className="relative">
            <select className={selectClass} value={cityCode} onChange={selectCity} disabled={!regionCode || loadingCities}>
              <option value="">{!regionCode ? 'Select a region first' : loadingCities ? 'Loading localities...' : 'Select locality'}</option>
              {visibleCities.map((city) => (
                <option key={city.code} value={city.code}>{city.name}</option>
              ))}
            </select>
            {loadingCities && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-slate-400" />}
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs text-slate-400">Barangay</span>
          <div className="relative">
            <select
              className={selectClass}
              value={barangayCode}
              onChange={selectBarangay}
              disabled={!cityCode || loadingBarangays}
            >
              <option value="">
                {!cityCode ? 'Select a locality first' : loadingBarangays ? 'Loading barangays...' : 'Select barangay'}
              </option>
              {visibleBarangays.map((barangay) => (
                <option key={barangay.code} value={barangay.code}>{barangay.name}</option>
              ))}
            </select>
            {loadingBarangays && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-slate-400" />}
          </div>
        </label>
      </div>
      <p className={`mt-1.5 text-xs ${loadError || error ? 'text-red-400' : 'text-slate-500'}`}>
        {loadError || error || 'Choose a PSGC region, locality, and barangay.'}
      </p>
    </div>
  );
}
