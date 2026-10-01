// Shared Open Graph / Twitter metadata for pages that set their own social tags.
// Next.js replaces (does not merge) a parent's openGraph/twitter object, so a page that
// sets openGraph would otherwise lose og:site_name, og:locale, og:type and the site-wide
// /opengraph-image. This keeps those, and gives each page its own og:url and title.

const defaultImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Ritumbhara — India, Thoughtfully Hosted",
  type: "image/png",
};

export function socialMetadata(path: string, title: string, description: string, imageUrl?: string) {
  const images = imageUrl ? [{ url: imageUrl }] : [defaultImage];
  return {
    openGraph: {
      type: "website" as const,
      locale: "en_IN",
      siteName: "Ritumbhara",
      url: path,
      title: title,
      description: description,
      images: images,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: title,
      description: description,
      images: images,
    },
  };
}
