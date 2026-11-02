import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Embedded Postgres ships WebAssembly and data files; load it from node_modules, not the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // A phone on the venue Wi-Fi opens the dev server by the laptop's LAN address (private ranges only).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
