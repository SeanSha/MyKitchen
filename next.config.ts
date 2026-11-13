import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["mac-mini.tail96b2ac.ts.net", "100.70.185.110", "127.0.0.1", "localhost"],
  serverExternalPackages: ["@google/genai"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }],
  },
};

export default nextConfig;
