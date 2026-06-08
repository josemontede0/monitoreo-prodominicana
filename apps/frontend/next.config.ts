import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: "http://192.168.0.239:4000",
  },
};

export default nextConfig;