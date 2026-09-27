import { assertEquals } from "jsr:@std/assert@1";
import { alertsForDay } from "./alerts.ts";

const MDT = -21600; // UTC−6
const DATE = "2026-09-28";

const alert = (props: Record<string, unknown>) => ({ properties: { status: "Actual", messageType: "Alert", ...props } });

Deno.test("alertsForDay keeps alerts overlapping the local hike day, most severe first", () => {
  const json = {
    features: [
      alert({
        id: "a1", event: "Wind Advisory", severity: "Moderate",
        onset: "2026-09-28T10:00:00-06:00", ends: "2026-09-28T20:00:00-06:00",
        headline: "Wind Advisory until 8 PM", instruction: "Secure   loose\n objects.",
      }),
      alert({
        id: "a2", event: "Flood Watch", severity: "Severe",
        onset: "2026-09-28T06:00:00-06:00", ends: "2026-09-30T06:00:00-06:00",
      }),
      // Ends the night before the hike day (local): excluded.
      alert({ id: "a3", event: "Frost Advisory", severity: "Minor", onset: "2026-09-27T02:00:00-06:00", ends: "2026-09-27T23:00:00-06:00" }),
      // Starts after the hike day: excluded.
      alert({ id: "a4", event: "Winter Storm Watch", severity: "Severe", onset: "2026-09-29T00:30:00-06:00", ends: "2026-09-30T00:00:00-06:00" }),
      // Tests and cancellations are ignored.
      alert({ id: "a5", event: "Test Message", status: "Test", onset: "2026-09-28T09:00:00-06:00" }),
      alert({ id: "a6", event: "Red Flag Warning", messageType: "Cancel", onset: "2026-09-28T09:00:00-06:00" }),
    ],
  };
  const result = alertsForDay(json, DATE, MDT);
  assertEquals(result.map((a) => a.event), ["Flood Watch", "Wind Advisory"]);
  assertEquals(result[1].instruction, "Secure loose objects.");
  assertEquals(result[1].ends, "2026-09-28T20:00:00-06:00");
});

Deno.test("alertsForDay dedupes the same watch re-issued by neighboring offices", () => {
  const watch = { event: "Flood Watch", severity: "Severe", onset: "2026-09-28T06:00:00-06:00", ends: "2026-09-30T06:00:00-06:00" };
  const result = alertsForDay({ features: [alert({ id: "x", ...watch }), alert({ id: "y", ...watch })] }, DATE, MDT);
  assertEquals(result.length, 1);
});

Deno.test("alertsForDay: open-ended alerts count; empty or malformed input is fine", () => {
  const result = alertsForDay(
    { features: [alert({ event: "Hydrologic Outlook", severity: "Unknown", onset: "2026-09-27T13:01:00-06:00", ends: null, expires: null })] },
    DATE,
    MDT,
  );
  assertEquals(result[0].severity, "Unknown");
  assertEquals(alertsForDay({ features: [] }, DATE, MDT), []);
  assertEquals(alertsForDay(null, DATE, MDT), []);
});
