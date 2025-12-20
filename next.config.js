const createNextIntlPlugin = require("next-intl/plugin")

const withNextIntl = createNextIntlPlugin()

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "uploadthing.com",
      "utfs.io",
      "img.youtube.com",
      "i.vimeocdn.com",
      "lh3.googleusercontent.com",
      "avatars.githubusercontent.com",
      "res.cloudinary.com",
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
}

module.exports = withNextIntl(nextConfig)
