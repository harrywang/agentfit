/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingExcludes: {
    '*': ['./dist-electron/**', './electron/server/**', './data/**'],
  },
}

export default nextConfig
