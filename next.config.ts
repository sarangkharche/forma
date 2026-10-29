import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  devIndicators: false,
  async redirects() { return [{ source: "/libraries", destination: "/libraries/index.html", permanent: false }]; },
};
export default config;
