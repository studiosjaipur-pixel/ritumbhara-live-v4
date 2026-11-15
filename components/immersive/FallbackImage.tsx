"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import DestinationScene, { type SceneSlug } from "./DestinationScene";

// A photo that never leaves a blank box. If the picture is missing or fails to load, an illustrated tile fills the
// space instead: the destination's scene when the place is verified, otherwise a plain brand pattern with no
// location claim. It is an illustration, never a stand-in photo of the room.
export default function FallbackImage({
  src,
  alt,
  sizes,
  className,
  priority,
  scene,
  note,
}: {
  src?: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  scene?: SceneSlug;
  note?: boolean;
}) {
  const [failed, setFailed] = useState(!src);
  const ref = useRef<HTMLImageElement>(null);

  // An image can fail before React attaches onError, so check once after mount as well.
  useEffect(function () {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <div role="img" aria-label={alt} className="absolute inset-0 overflow-hidden bg-[#240713]">
        {scene ? <DestinationScene slug={scene} /> : <div aria-hidden className="absolute inset-0 rb-jaali-dark" />}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#240713]/55 to-transparent" />
        {note !== false && (
          <p className="absolute bottom-3 left-3 right-3 text-[11px] font-medium text-ivory/80">Photo unavailable right now. Ask us on WhatsApp for current pictures.</p>
        )}
      </div>
    );
  }
  return (
    <Image
      ref={ref}
      src={src as string}
      alt={alt}
      fill
      sizes={sizes}
      quality={70}
      priority={priority}
      className={className}
      onError={function () { setFailed(true); }}
    />
  );
}
