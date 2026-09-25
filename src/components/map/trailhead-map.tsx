"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

export type LatLng = { lat: number; lng: number };

// Colorado Front Range, used when there's no pin yet.
const DEFAULT_CENTER: LatLng = { lat: 39.65, lng: -105.25 };

// A drawn pin instead of Leaflet's default PNG marker (which breaks under bundlers).
const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 43C17 43 32 27.5 32 16.5C32 7.9 25.3 1 17 1C8.7 1 2 7.9 2 16.5C2 27.5 17 43 17 43Z" fill="#2f5d3a" stroke="#f7f4ec" stroke-width="2"/>
    <path d="M9 22 L15 13 L18 17.5 L20 15 L25 22 Z" fill="#f7f4ec"/>
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

function ClickToPlace({ onChange }: { onChange: (v: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function FollowValue({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) {
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 12));
    }
  }, [map, value]);
  return null;
}

export default function TrailheadMap({
  value,
  onChange,
  className = "h-64",
}: {
  value: LatLng | null;
  onChange?: (v: LatLng) => void;
  className?: string;
}) {
  const center = value ?? DEFAULT_CENTER;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={value ? 13 : 9}
      scrollWheelZoom={false}
      className={`${className} z-0 w-full rounded-xl`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
      {onChange && <ClickToPlace onChange={onChange} />}
      <FollowValue value={value} />
    </MapContainer>
  );
}
