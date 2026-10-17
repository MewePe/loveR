import type { NextConfig } from "next";

// No remotePatterns: all images are served from this app. A wildcard pattern ('**') would turn
// /_next/image into an open proxy that fetches any URL on the server's behalf.
const nextConfig: NextConfig = {};

export default nextConfig;
