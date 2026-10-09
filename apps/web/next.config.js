/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@traceback/shared-types"],
};

module.exports = nextConfig;
