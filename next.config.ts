import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_PROJECT_NAME: process.env.PROJECT_NAME || "MyProject",
    NEXT_PUBLIC_MAIN_REPO_PATH: process.env.MAIN_REPO_PATH || "",
  },
};

export default nextConfig;
