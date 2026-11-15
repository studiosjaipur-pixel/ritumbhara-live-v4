// A slow ticker of the ten Ritumbhara Standard commitments. Pure CSS, so it costs no JavaScript; it pauses on
// hover, stops for people who prefer reduced motion, and the repeated copy is hidden from screen readers.
export default function StandardMarquee({ items }: { items: string[] }) {
  const row = (
    <ul className="flex shrink-0 items-center">
      {items.map(function (it) {
        return (
          <li key={it} className="flex items-center whitespace-nowrap font-display text-[1.6rem] sm:text-3xl text-ivory">
            <span className="px-7">{it}</span>
            <span aria-hidden className="text-gold text-xl">✦</span>
          </li>
        );
      })}
    </ul>
  );
  return (
    <section aria-label="The Ritumbhara Standard" className="group relative overflow-hidden bg-burgundy py-6 border-y border-burgundy-deep">
      <div aria-hidden className="absolute inset-0 rb-jaali opacity-[0.10]" />
      <div className="relative flex w-max rb-marquee group-hover:[animation-play-state:paused]">
        {row}
        <div aria-hidden>{row}</div>
      </div>
    </section>
  );
}
