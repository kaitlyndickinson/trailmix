"use client";

import { useRef, useState, useTransition } from "react";
import { TrailheadMap, type LatLng } from "@/components/map";
import { inputClass, labelClass, secondaryButtonClass } from "@/components/ui";
import type { PlaceResult } from "@/lib/clients/photon";
import {
  googleMapsSearchUrl,
  isMapsShortLink,
  parseCoords,
} from "@/lib/maps-link";
import { resolveMapsLink, searchTrailheads } from "./locate-actions";

/**
 * Four ways to set the trailhead: search by name, paste coordinates or a
 * Google/Apple Maps link (share links included), tap the map, or use the
 * phone's location.
 */
export function TrailheadPicker({
  value,
  onChange,
  suggestedQuery,
}: {
  value: LatLng | null;
  onChange: (pin: LatLng | null) => void;
  suggestedQuery: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [resolving, startResolve] = useTransition();
  const [locating, setLocating] = useState(false);
  // Paste and the following blur both deliver the same text; handle it once.
  const lastPasted = useRef("");

  const searchText = query.trim() || suggestedQuery.trim();

  function search() {
    if (!searchText) {
      setMessage("Type a trail, peak, or trailhead name.");
      return;
    }
    setMessage(null);
    startSearch(async () => {
      const { results, error } = await searchTrailheads(searchText, value);
      if (error) setMessage(error);
      setResults(results ?? null);
      if (results && results.length === 0) {
        setMessage(
          "No matches. Try the peak or trail name, or open Google Maps.",
        );
      }
    });
  }

  function choose(result: PlaceResult) {
    onChange({ lat: result.lat, lng: result.lng });
    setResults(null);
    setMessage(`Pinned ${result.name}. Tap the map to fine-tune.`);
  }

  function handlePasted(text: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed === lastPasted.current) return;
    lastPasted.current = trimmed;
    const coords = parseCoords(trimmed);
    if (coords) {
      onChange(coords);
      setMessage("Pinned from the pasted location.");
      return;
    }
    if (isMapsShortLink(trimmed)) {
      setMessage("Opening the Google Maps link…");
      startResolve(async () => {
        const { coords, error } = await resolveMapsLink(trimmed);
        if (coords) {
          onChange(coords);
          setMessage("Pinned from the Google Maps link.");
        } else {
          setMessage(error ?? "Couldn't read that link.");
        }
      });
      return;
    }
    setMessage(
      "Couldn't find a location. Paste coordinates like “39.64, -105.19” or a Google Maps link.",
    );
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setMessage("Couldn't get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={labelClass}>Trailhead</legend>

      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // don't submit the trip form
              search();
            }
          }}
          placeholder={suggestedQuery || "Search: Mount Bierstadt"}
          aria-label="Search for a trailhead"
          enterKeyHint="search"
          className={inputClass}
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className={secondaryButtonClass}
        >
          {searching ? "…" : "Search"}
        </button>
      </div>

      {results && results.length > 0 && (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 bg-white">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng},${r.name}`}>
              <button
                type="button"
                onClick={() => choose(r)}
                className="active:bg-sand flex min-h-12 w-full flex-col items-start px-3 py-2 text-left"
              >
                <span className="font-medium">
                  {r.name}{" "}
                  <span className="text-forest text-xs font-semibold uppercase">
                    {r.kind}
                  </span>
                </span>
                {r.detail && (
                  <span className="text-foreground/60 text-sm">{r.detail}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <TrailheadMap value={value} onChange={onChange} />

      <input
        type="text"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="Paste coordinates or a Google Maps link"
        placeholder="Paste coordinates or a Google Maps link"
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text");
          e.currentTarget.value = text;
          handlePasted(text);
        }}
        onBlur={(e) => handlePasted(e.currentTarget.value)}
        className={inputClass}
      />

      {(message || resolving) && (
        <p role="status" className="text-foreground/70 text-sm">
          {resolving ? "Opening the Google Maps link…" : message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className={`${secondaryButtonClass} flex-1`}
        >
          {locating ? "Locating…" : "Use my location"}
        </button>
        {searchText && (
          <a
            href={googleMapsSearchUrl(searchText)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${secondaryButtonClass} flex-1`}
          >
            Open in Google Maps
          </a>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={secondaryButtonClass}
          >
            Clear pin
          </button>
        )}
      </div>

      {value && (
        <p className="text-foreground/50 font-mono text-xs">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </fieldset>
  );
}
