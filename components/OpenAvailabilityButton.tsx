"use client";
import { openAvailability } from "@/lib/availability-events";

// A button that opens the site-wide "Check availability" dialog, optionally with a destination or stay chosen.
export default function OpenAvailabilityButton({
  children,
  className,
  destination,
  property,
  onClick,
}: {
  children?: React.ReactNode;
  className?: string;
  destination?: string;
  property?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={className}
      onClick={function () {
        if (onClick) onClick();
        openAvailability({ destination: destination, property: property });
      }}
    >
      {children}
    </button>
  );
}
