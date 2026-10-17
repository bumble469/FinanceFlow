/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
      { key: "Pragma", value: "no-cache" },
    ];
    return [
      { source: "/plans/:path*", headers: noStore },
      { source: "/settings/:path*", headers: noStore },
      { source: "/connections/:path*", headers: noStore },
      { source: "/onboarding/:path*", headers: noStore },
    ];
  },
}

export default nextConfig