import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.cobbcounty.gov",
      },
    ],
  },
};

export default nextConfig;
