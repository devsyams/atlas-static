import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve its internal /_next/* requests when the app is
  // reached through a public tunnel (ngrok / cloudflared) instead of localhost.
  // Without this, Next 16 dev treats the tunnel host as cross-origin and the app
  // never hydrates, so pages render but show no data. Add your exact domain here
  // if the wildcards below don't match it.
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.ngrok-free.dev",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
