"use client";
import { useScroll, useTransform } from "framer-motion";
import DestinationScene, { type SceneSlug } from "./DestinationScene";

// The illustrated destination scene as a page-top backdrop; its layers drift apart over the first screen of scrolling.
export default function SceneBackdrop({ slug }: { slug: SceneSlug }) {
  const { scrollY } = useScroll();
  const progress = useTransform(scrollY, [0, 700], [0, 1]);
  return <DestinationScene slug={slug} progress={progress} />;
}
