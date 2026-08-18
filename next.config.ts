import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We maintain a curated AGENTS.md. Disable Next's auto-generation so it does
  // not overwrite our file (and re-introduce its own boilerplate) on every dev run.
  agentRules: false,
};

export default nextConfig;
