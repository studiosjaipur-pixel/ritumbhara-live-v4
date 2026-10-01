/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
remotePatterns: [
{
protocol: "https",
  hostname: "multimedia.hotel-spider.com",
  },
  ],
  },
  };
module.exports = nextConfig;
