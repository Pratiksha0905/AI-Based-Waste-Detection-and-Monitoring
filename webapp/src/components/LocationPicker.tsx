import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface SelectedLocation {
  latitude: number;
  longitude: number;
}

function MapClickHandler({ onSelect }: { onSelect: (location: SelectedLocation) => void }) {
  useMapEvents({
    click(event: { latlng: LatLng }) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });
  return null;
}

interface LocationPickerProps {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
}

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-800 mb-2">Select the report location</p>
      <p className="text-xs text-gray-500 mb-3">Click the map to place the report marker.</p>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <MapContainer
          center={value ? [value.latitude, value.longitude] : [12.9716, 77.5946]}
          zoom={value ? 15 : 11}
          className="w-full"
          style={{ height: 320 }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapClickHandler onSelect={onChange} />
          {value && <Marker position={[value.latitude, value.longitude]} />}
        </MapContainer>
      </div>
      {value && (
        <p className="mt-2 text-xs text-gray-600" aria-live="polite">
          Selected: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}
