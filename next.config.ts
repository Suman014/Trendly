import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["groq-sdk", "@google/generative-ai"],
};

export default nextConfig;
