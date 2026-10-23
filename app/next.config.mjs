/** @type {import('next').NextConfig} */
const nextConfig = {
  // Step 5 adds the 301 redirects from old article URLs to /blog/[slug].
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }]
  },
}
export default nextConfig
