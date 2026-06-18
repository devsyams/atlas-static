import type { NextConfig } from "next";

// ci: smoke-test of the DOCR -> ArgoCD deploy pipeline (2026-06-18)
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
