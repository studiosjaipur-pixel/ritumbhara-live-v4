/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Serve AVIF where the browser supports it (falling back to WebP), so above-the-fold photos such as
    // property heroes (the LCP element on property pages) download smaller files (UX-006).
    formats: ["image/avif", "image/webp"],
    // Keep optimised Hotel-Spider photos in Vercel's image cache for 31 days instead of the 60-second
    // default, so visitors (and lab tests) are not left waiting while the original is fetched and resized again.
    minimumCacheTTL: 2678400,
remotePatterns: [
{
protocol: "https",
  hostname: "multimedia.hotel-spider.com",
  },
  ],
  },
  };
module.exports = nextConfig;
