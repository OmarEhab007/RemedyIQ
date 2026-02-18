import type { NextConfig } from "next";

// Extract origin from API URL (CSP connect-src needs origin, not full path)
function getApiOrigin(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  try {
    return new URL(apiUrl).origin;
  } catch {
    return "http://localhost:8080";
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    const apiOrigin = getApiOrigin();
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.accounts.dev",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              `connect-src 'self' ${apiOrigin} ws://localhost:8080 wss://localhost:8080`,
              "frame-src 'self' https://*.clerk.accounts.dev",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
