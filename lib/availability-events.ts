// Any button on the site can open the "Check availability" dialog (components/AvailabilityDialog.tsx) with
// a destination or a specific stay already chosen.
export const OPEN_AVAILABILITY_EVENT = "rb:open-availability";

export interface OpenAvailabilityDetail {
  destination?: string;
  property?: string;
}

export function openAvailability(detail?: OpenAvailabilityDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_AVAILABILITY_EVENT, { detail: detail || {} }));
}
