import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No floating dev badge in the corner during demos.
  devIndicators: false,
  // The file driver reads a path from an environment variable, which makes the bundler trace the whole
  // project "just in case". Nothing in these folders belongs in a serverless function.
  outputFileTracingExcludes: {
    "/api/**": ["./public/**", "./data/runtime-*", "./.next/cache/**", "./node_modules/.cache/**"],
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/data/runtime-db.json", "**/data/runtime-files/**", "**/dev.log"],
    };
    return config;
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
