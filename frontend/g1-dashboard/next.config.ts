import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
  allowedDevOrigins: ['192.168.1.13', '192.168.1.107', '192.168.201.146','192.168.1.15'],
};

export default nextConfig;
