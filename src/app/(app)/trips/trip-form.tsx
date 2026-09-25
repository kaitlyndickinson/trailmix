"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { TrailheadMap, type LatLng } from "@/components/map";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { parseCoords } from "@/lib/trip-fields";
import { createTrip, updateTrip, type TripFormState } from "./actions";

export type TripFormValues = {
  id?: string;
  name: string;
  trip_date: string | null;
  trail_name: string | null;
  trail_url: string | null;
  trailhead_lat: number | null;
  trailhead_lng: number | null;
};

export function TripForm({
  trip,
  templates,
}: {
  trip?: TripFormValues;
  templates?: { id: string; name: string }[];
}) {
  const editing = Boolean(trip?.id);
  const [state, formAction, pending] = useActionState<TripFormState, FormData>(
    editing ? updateTrip : createTrip,
    {},
  );
  const [pin, setPin] = useState<LatLng | null>(
    trip?.trailhead_lat != null && trip?.trailhead_lng != null
      ? { lat: trip.trailhead_lat, lng: trip.trailhead_lng }
      : null,
  );
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function handlePaste(text: string) {
    if (!text.trim()) return setPasteError(null);
    const coords = parseCoords(text);
    if (coords) {
      setPin(coords);
      setPasteError(null);
    } else {
      setPasteError("Couldn't find coordinates. Try “39.64, -105.19”.");
    }
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {trip?.id && <input type="hidden" name="id" value={trip.id} />}
      <input type="hidden" name="trailhead_lat" value={pin?.lat ?? ""} />
      <input type="hidden" name="trailhead_lng" value={pin?.lng ?? ""} />

      <div>
        <label htmlFor="name" className={labelClass}>
          Trip name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={trip?.name}
          placeholder="Mt. Falcon Sunday"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="trip_date" className={labelClass}>
          Date{" "}
          <span className="text-foreground/50 font-normal">(optional)</span>
        </label>
        <input
          id="trip_date"
          name="trip_date"
          type="date"
          defaultValue={trip?.trip_date ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="trail_url" className={labelClass}>
          AllTrails link
        </label>
        <input
          id="trail_url"
          name="trail_url"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          defaultValue={trip?.trail_url ?? ""}
          placeholder="https://www.alltrails.com/trail/…"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="trail_name" className={labelClass}>
          Trail name
        </label>
        <input
          id="trail_name"
          name="trail_name"
          defaultValue={trip?.trail_name ?? ""}
          placeholder="Castle Trail"
          className={inputClass}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Trailhead</legend>
        <p className="text-foreground/60 text-sm">
          Tap the map, or paste coordinates or a Google Maps link.
        </p>
        <TrailheadMap value={pin} onChange={setPin} />
        <input
          aria-label="Paste coordinates"
          placeholder="39.64, -105.19"
          inputMode="decimal"
          onBlur={(e) => handlePaste(e.currentTarget.value)}
          onPaste={(e) => handlePaste(e.clipboardData.getData("text"))}
          className={inputClass}
        />
        {pasteError && <p className="text-sm text-red-700">{pasteError}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className={`${secondaryButtonClass} flex-1`}
          >
            {locating ? "Locating…" : "Use my location"}
          </button>
          {pin && (
            <button
              type="button"
              onClick={() => setPin(null)}
              className={secondaryButtonClass}
            >
              Clear pin
            </button>
          )}
        </div>
        {pin && (
          <p className="text-foreground/50 font-mono text-xs">
            {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
          </p>
        )}
      </fieldset>

      {!editing && templates && templates.length > 0 && (
        <div>
          <label htmlFor="template_id" className={labelClass}>
            Start checklist from
          </label>
          <select
            id="template_id"
            name="template_id"
            defaultValue={templates[0].id}
            className={inputClass}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="">Empty checklist</option>
          </select>
        </div>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Link
          href={trip?.id ? `/trips/${trip.id}` : "/"}
          className={secondaryButtonClass}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className={`${primaryButtonClass} flex-1`}
        >
          {pending ? "Saving…" : editing ? "Save changes" : "Create trip"}
        </button>
      </div>
    </form>
  );
}
