import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.NEXT_PUBLIC_STYLIST_DEMO === "true" ? ".next-demo" : ".next",
};

export default config;
