import type { NextConfig } from "next";
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const config: NextConfig = {
  // Project sites serve the exported app below the repository name.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  ...(isGitHubPages ? { output: "export", trailingSlash: true } : {}),
  // Use the compiler API with TypeScript 5 rather than the experimental CLI bridge.
  experimental: { useTypeScriptCli: false },
};
export default config;
