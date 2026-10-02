/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
