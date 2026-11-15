"use client";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { useId } from "react";

export type SceneSlug = "jaipur" | "alwar" | "sariska" | "agra";

const W = 1440;
const H = 800;
const BOT = H + 160;

// Deterministic random, so the server and the browser draw the same scene.
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const f = function (n: number) { return n.toFixed(1); };

// A row of havelis: some topped with a dome and finial, some with a battlemented roof.
function havelis(seed: number, base: number, minH: number, maxH: number, wMin: number, wMax: number): string {
  const r = rng(seed);
  let x = -30;
  let d = "M-30," + BOT + " ";
  let fin = "";
  while (x < W + 50) {
    const w = wMin + r() * (wMax - wMin);
    const top = base - (minH + r() * (maxH - minH));
    d += "L" + f(x) + "," + f(top) + " ";
    if (r() > 0.45) {
      const inset = w * 0.14;
      const rad = (w - inset * 2) / 2;
      d += "L" + f(x + inset) + "," + f(top) + " A" + f(rad) + "," + f(rad) + " 0 0 1 " + f(x + w - inset) + "," + f(top) + " ";
      const cx = x + w / 2;
      fin += "M" + f(cx - 2) + "," + f(top - rad) + " L" + f(cx) + "," + f(top - rad - 16) + " L" + f(cx + 2) + "," + f(top - rad) + "Z ";
    } else {
      const n = Math.max(2, Math.round(w / 16));
      const step = w / n;
      for (let i = 0; i < n; i++) {
        const bx = x + i * step;
        d += "L" + f(bx) + "," + f(top - 8) + " L" + f(bx + step * 0.55) + "," + f(top - 8) + " L" + f(bx + step * 0.55) + "," + f(top) + " L" + f(bx + step) + "," + f(top) + " ";
      }
    }
    d += "L" + f(x + w) + "," + f(top) + " ";
    x += w;
  }
  return d + "L" + f(x) + "," + BOT + "Z " + fin;
}

// A hill crowned by a battlemented fort wall with three domed towers.
function fort(): string {
  const hill = "M-30," + BOT + " L-30,570 C180,530 360,480 560,410 C700,360 780,340 900,340 C1040,340 1180,430 1300,510 C1360,550 1420,570 1480,580 L1480," + BOT + "Z ";
  const wx = 620, ww = 520, wy = 310, wh = 120;
  let wall = "M" + wx + "," + (wy + wh) + " L" + wx + "," + wy + " ";
  const n = 26;
  const st = ww / n;
  for (let i = 0; i < n; i++) {
    const x = wx + i * st;
    wall += "L" + f(x) + "," + (wy - 9) + " L" + f(x + st * 0.55) + "," + (wy - 9) + " L" + f(x + st * 0.55) + "," + wy + " L" + f(x + st) + "," + wy + " ";
  }
  wall += "L" + (wx + ww) + "," + (wy + wh) + "Z ";
  let towers = "";
  [wx - 14, wx + ww / 2 - 28, wx + ww - 42].forEach(function (tx) {
    towers += "M" + tx + "," + (wy + wh) + " L" + tx + "," + (wy - 110) + " A28,28 0 0 1 " + (tx + 56) + "," + (wy - 110) + " L" + (tx + 56) + "," + (wy + wh) + "Z ";
    towers += "M" + (tx + 26) + "," + (wy - 138) + " L" + (tx + 28) + "," + (wy - 158) + " L" + (tx + 30) + "," + (wy - 138) + "Z ";
  });
  return hill + wall + towers;
}

// Rounded evergreen crowns, overlapping into a canopy.
function trees(seed: number, base: number, hMin: number, hMax: number, wMin: number, wMax: number): string {
  const r = rng(seed);
  let x = -40;
  let d = "M-40," + BOT + " ";
  while (x < W + 70) {
    const w = wMin + r() * (wMax - wMin);
    const h = hMin + r() * (hMax - hMin);
    d += "L" + f(x) + "," + f(base) + " Q" + f(x + w * 0.2) + "," + f(base - h * 0.55) + " " + f(x + w / 2) + "," + f(base - h) + " Q" + f(x + w * 0.8) + "," + f(base - h * 0.55) + " " + f(x + w) + "," + f(base) + " ";
    x += w * 0.6;
  }
  return d + "L" + f(x) + "," + BOT + "Z";
}

// A generic white-marble domed mausoleum with four minarets, standing for Agra.
function marble(): string {
  const cx = 720, by = 560;
  let d = "M-30," + BOT + " L-30," + (by + 60) + " L" + (W + 30) + "," + (by + 60) + " L" + (W + 30) + "," + BOT + "Z ";
  d += "M" + (cx - 190) + "," + (by + 60) + " L" + (cx - 190) + "," + (by - 60) + " L" + (cx + 190) + "," + (by - 60) + " L" + (cx + 190) + "," + (by + 60) + "Z ";
  d += "M" + (cx - 120) + "," + (by - 60) + " C" + (cx - 150) + "," + (by - 150) + " " + (cx - 70) + "," + (by - 250) + " " + cx + "," + (by - 300) + " C" + (cx + 70) + "," + (by - 250) + " " + (cx + 150) + "," + (by - 150) + " " + (cx + 120) + "," + (by - 60) + "Z ";
  d += "M" + (cx - 3) + "," + (by - 300) + " L" + cx + "," + (by - 345) + " L" + (cx + 3) + "," + (by - 300) + "Z ";
  [-1, 1].forEach(function (s) {
    const x = cx + s * 160;
    d += "M" + (x - 34) + "," + (by - 60) + " C" + (x - 40) + "," + (by - 110) + " " + (x - 14) + "," + (by - 140) + " " + x + "," + (by - 150) + " C" + (x + 14) + "," + (by - 140) + " " + (x + 40) + "," + (by - 110) + " " + (x + 34) + "," + (by - 60) + "Z ";
  });
  [-300, -230, 230, 300].forEach(function (o) {
    const x = cx + o;
    d += "M" + (x - 11) + "," + (by + 60) + " L" + (x - 11) + "," + (by - 200) + " A11,11 0 0 1 " + (x + 11) + "," + (by - 200) + " L" + (x + 11) + "," + (by + 60) + "Z ";
    d += "M" + (x - 1.5) + "," + (by - 210) + " L" + x + "," + (by - 232) + " L" + (x + 1.5) + "," + (by - 210) + "Z ";
  });
  return d;
}

interface Palette {
  sky: string[];
  sun: string;
  far: string;
  mid: string;
  near: string;
  mist: string;
  stars: boolean;
}

const PALETTES: Record<SceneSlug, Palette> = {
  jaipur: { sky: ["#2E0B1B", "#7A1231", "#D2674A", "#F3C98B"], sun: "#FDE7B8", far: "#B4466B", mid: "#7F1C40", near: "#32091B", mist: "#F3C98B", stars: true },
  alwar: { sky: ["#18241E", "#4D5B44", "#C9A662", "#F1DDB0"], sun: "#FFF1CC", far: "#7A8A6A", mid: "#47543F", near: "#1B261F", mist: "#F1DDB0", stars: true },
  sariska: { sky: ["#10201A", "#2C4A3A", "#A9A26A", "#E7D9A8"], sun: "#FFF3C9", far: "#59785F", mid: "#2D4A3A", near: "#101E17", mist: "#E7D9A8", stars: false },
  agra: { sky: ["#241E3C", "#7B5078", "#E8A184", "#FBE6CB"], sun: "#FFF0D6", far: "#A9768B", mid: "#654562", near: "#241E3C", mist: "#FBE6CB", stars: true },
};

const SEEDS: Record<SceneSlug, number> = { jaipur: 7, alwar: 13, sariska: 29, agra: 41 };

function paths(slug: SceneSlug): { far: string; mid: string; near: string } {
  const s = SEEDS[slug];
  if (slug === "jaipur") return { far: havelis(s, 560, 60, 150, 70, 150), mid: havelis(s + 1, 650, 90, 210, 90, 170), near: havelis(s + 2, 750, 70, 190, 110, 210) };
  if (slug === "alwar") return { far: trees(s, 600, 70, 150, 120, 220), mid: fort(), near: trees(s + 1, 760, 120, 260, 160, 280) };
  if (slug === "sariska") return { far: trees(s, 560, 120, 240, 130, 240), mid: trees(s + 1, 650, 160, 320, 150, 270), near: trees(s + 2, 770, 200, 400, 190, 320) };
  return { far: havelis(s, 600, 40, 110, 80, 150), mid: marble(), near: havelis(s + 1, 760, 60, 150, 120, 220) };
}

export default function DestinationScene({
  slug,
  progress,
  className,
}: {
  slug: SceneSlug;
  progress?: MotionValue<number>;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = PALETTES[slug];
  const zero = useMotionValue(0);
  const pr = progress || zero;
  const ySun = useTransform(pr, [0, 1], [0, 90]);
  const yFar = useTransform(pr, [0, 1], [0, 30]);
  const yMid = useTransform(pr, [0, 1], [0, 70]);
  const yNear = useTransform(pr, [0, 1], [0, 130]);
  const d = paths(slug);
  const r = rng(SEEDS[slug] * 3);
  const stars: { x: number; y: number; r: number; t: number }[] = [];
  if (p.stars) for (let i = 0; i < 34; i++) stars.push({ x: r() * W, y: r() * 300, r: 0.8 + r() * 1.4, t: r() * 4 });
  const birds: { x: number; y: number; t: number }[] = [];
  for (let i = 0; i < 5; i++) birds.push({ x: 160 + r() * 1000, y: 150 + r() * 160, t: r() * 8 });

  return (
    <svg
      viewBox={"0 0 " + W + " " + H}
      preserveAspectRatio="xMidYMax slice"
      className={"absolute inset-0 h-full w-full " + (className || "")}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id + "sky"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.42" stopColor={p.sky[1]} />
          <stop offset="0.74" stopColor={p.sky[2]} />
          <stop offset="1" stopColor={p.sky[3]} />
        </linearGradient>
        <radialGradient id={id + "sun"}>
          <stop offset="0" stopColor={p.sun} stopOpacity="1" />
          <stop offset="0.35" stopColor={p.sun} stopOpacity="0.55" />
          <stop offset="1" stopColor={p.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id + "mist"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.mist} stopOpacity="0" />
          <stop offset="1" stopColor={p.mist} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <rect width={W} height={H + 200} fill={"url(#" + id + "sky)"} />
      {stars.map(function (st, i) {
        return <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#FFF6E0" className="rb-twinkle" style={{ animationDelay: st.t + "s" }} />;
      })}
      <motion.g style={{ y: ySun }}>
        <circle cx={slug === "alwar" ? 420 : 960} cy={470} r={380} fill={"url(#" + id + "sun)"} className="rb-sun" />
        <circle cx={slug === "alwar" ? 420 : 960} cy={470} r={64} fill={p.sun} />
      </motion.g>
      <motion.g style={{ y: yFar }}>
        <path d={d.far} fill={p.far} fillRule="nonzero" />
      </motion.g>
      <rect y={H * 0.5} width={W} height={H * 0.55} fill={"url(#" + id + "mist)"} />
      <motion.g style={{ y: yMid }}>
        <path d={d.mid} fill={p.mid} />
      </motion.g>
      {birds.map(function (b, i) {
        return <path key={i} d={"M" + b.x + "," + b.y + " q10,-9 20,0 q10,-9 20,0"} fill="none" stroke={p.near} strokeWidth="2" strokeLinecap="round" opacity="0.7" className="rb-bird" style={{ animationDelay: b.t + "s" }} />;
      })}
      <motion.g style={{ y: yNear }}>
        <path d={d.near} fill={p.near} />
      </motion.g>
    </svg>
  );
}
