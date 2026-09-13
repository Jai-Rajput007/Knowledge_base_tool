import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR WebSocket connections from any device on the local network.
  // Without this, browsers accessing via LAN IP (e.g. 192.168.1.x) get
  // WebSocket connection errors in the console because Next.js blocks
  // cross-origin HMR connections by default.
  allowedDevOrigins: [
    "192.168.1.107",
    "192.168.1.0/24",   // Entire local subnet — covers any device on your WiFi
    "192.168.0.0/24",   // Alternate common subnet
    "10.0.0.0/8",       // Some routers use this range
    "172.20.10.0/24",   // iPhone hotspot (172.20.10.x)
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
