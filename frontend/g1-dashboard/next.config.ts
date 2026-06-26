import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
  allowedDevOrigins: ['192.168.1.13', '192.168.1.61', '192.168.201.146'],
};

export default nextConfig;
