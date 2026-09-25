"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { formatTripDate, localToday } from "@/lib/trip-fields";

type TripRow = {
  id: string;
  name: string;
  trip_date: string | null;
  trail_name: string | null;
  status: string;
  total: number;
  checked: number;
};

// Grouped on the client so "today" is the viewer's local date, not the server's.
const noopSubscribe = () => () => {};

export function TripList({ trips }: { trips: TripRow[] }) {
  // null during SSR/hydration, then the device's local date.
  const today =
    useSyncExternalStore(noopSubscribe, localToday, () => null) ?? "";
  const upcoming: TripRow[] = [];
  const someday: TripRow[] = [];
  const done: TripRow[] = [];

  for (const trip of trips) {
    if (trip.status === "done" || (trip.trip_date && trip.trip_date < today)) {
      done.push(trip);
    } else if (trip.trip_date) {
      upcoming.push(trip);
    } else {
      someday.push(trip);
    }
  }
  done.reverse(); // most recent first

  if (trips.length === 0) {
    return (
      <div className="border-forest/30 rounded-2xl border border-dashed p-8 text-center">
        <p className="font-medium">No trips yet</p>
        <p className="text-foreground/60 mt-1 text-sm">
          Add a trail and a date to start a shared checklist.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Group title="Upcoming" trips={upcoming} today={today} />
      <Group title="Someday" trips={someday} today={today} />
      <Group title="Done" trips={done} today={today} muted />
    </div>
  );
}

function Group({
  title,
  trips,
  today,
  muted,
}: {
  title: string;
  trips: TripRow[];
  today: string;
  muted?: boolean;
}) {
  if (trips.length === 0) return null;
  return (
    <section>
      <h2 className="text-forest mb-2 text-xs font-semibold tracking-widest uppercase">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {trips.map((trip) => (
          <li key={trip.id}>
            <Link
              href={`/trips/${trip.id}`}
              className={`active:bg-sand flex min-h-16 items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 ${
                muted ? "opacity-70" : ""
              }`}
            >
              <DateBadge
                date={trip.trip_date}
                isToday={trip.trip_date === today}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{trip.name}</p>
                <p className="text-foreground/60 truncate text-sm">
                  {trip.trail_name ??
                    (trip.trip_date
                      ? formatTripDate(trip.trip_date)
                      : "No date yet")}
                </p>
              </div>
              {trip.total > 0 && (
                <span className="text-foreground/50 shrink-0 font-mono text-xs">
                  {trip.checked}/{trip.total}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DateBadge({
  date,
  isToday,
}: {
  date: string | null;
  isToday: boolean;
}) {
  if (!date) {
    return (
      <span
        aria-hidden
        className="bg-sand flex size-12 shrink-0 items-center justify-center rounded-xl text-lg"
      >
        ⛰
      </span>
    );
  }
  const [y, m, d] = date.split("-").map(Number);
  const month = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
  });
  return (
    <span
      className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${
        isToday ? "bg-sun text-foreground" : "bg-forest/10 text-forest"
      }`}
    >
      <span className="text-[10px] font-semibold uppercase">
        {isToday ? "Today" : month}
      </span>
      <span className="text-lg font-semibold">{d}</span>
    </span>
  );
}
