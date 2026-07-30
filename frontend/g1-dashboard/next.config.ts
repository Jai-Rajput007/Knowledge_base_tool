import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
  // Subnet-level allow list so ANY device on the local network can connect.
  // Avoids having to hardcode each device IP individually.
  allowedDevOrigins: [
    "192.168.1.107",
    "192.168.1.0/24",
    "192.168.0.0/24",
    "192.168.201.0/24",
    "10.0.0.0/8",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
