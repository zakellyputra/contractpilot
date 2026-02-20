import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    resolveAlias: {
      // react-pdf requires canvas to be disabled in SSR
      canvas: { browser: "canvas" },
    },
  },
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
