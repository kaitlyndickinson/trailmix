"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { LatLng } from "@/components/map";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { createTrip, updateTrip, type TripFormState } from "./actions";
import { TrailheadPicker } from "./trailhead-picker";

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
  const [trailName, setTrailName] = useState(trip?.trail_name ?? "");

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
          value={trailName}
          onChange={(e) => setTrailName(e.target.value)}
          placeholder="Castle Trail"
          className={inputClass}
        />
      </div>

      <TrailheadPicker
        value={pin}
        onChange={setPin}
        suggestedQuery={trailName}
      />

      {!editing && templates && templates.length > 0 && (
        <div>
          <label htmlFor="template_id" className={labelClass}>
            Checklist{" "}
            <span className="text-foreground/50 font-normal">(optional)</span>
          </label>
          <select
            id="template_id"
            name="template_id"
            defaultValue=""
            className={inputClass}
          >
            <option value="">No checklist</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                Start from “{t.name}”
              </option>
            ))}
          </select>
          <p className="text-foreground/60 mt-1 text-sm">
            You can add one later from the trip.
          </p>
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
