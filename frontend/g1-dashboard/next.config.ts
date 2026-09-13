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
    "172.20.10.0/24",   // iPhone hotspot (172.20.10.x)
    "localhost",
    "127.0.0.1",
  ],
  // Same-origin proxy for the FastAPI backend.
  //
  // The browser bundle inlines NEXT_PUBLIC_API_URL at BUILD time, so a hardcoded
  // LAN IP (http://192.168.1.107:8000/api/v1) only works for devices already on
  // that subnet. Behind a tunnel (ngrok) or from any external network, the page
  // loads but every API call dies on an unreachable private address.
  //
  // With this rewrite, NEXT_PUBLIC_API_URL can be the RELATIVE path "/api/v1":
  // the browser calls whatever origin served the page, Next.js proxies it to the
  // backend server-side, and the same build works on localhost, LAN, and tunnel
  // with no rebuild when the public URL changes.
  //
  // "/api/v1" does not collide with the app's own route handlers under app/api/
  // (auth, events, tickets, wakewords) — none of them is named "v1".
  async rewrites() {
    const backend =
      process.env.BACKEND_INTERNAL_URL || "http://localhost:8000/api/v1";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
