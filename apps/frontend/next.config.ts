import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Local. Para el servidor institucional: http://192.168.0.239:4000
    NEXT_PUBLIC_API_URL: "http://localhost:4000",
  },
};

export default nextConfig;