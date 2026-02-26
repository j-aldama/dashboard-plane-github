/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output for Docker multi-stage builds
  output: "standalone",
  // Allow API calls to the FastAPI backend container via Docker network
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://api:8000"}/:path*`,
      },
    ];
  },
  // Disable x-powered-by header for security
  poweredByHeader: false,
  // Enable strict mode for React
  reactStrictMode: true,
};

module.exports = nextConfig;
