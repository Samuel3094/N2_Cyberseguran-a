// Exportação estática para publicação no GitHub Pages (HTTPS com certificado TLS do GitHub).
// NEXT_PUBLIC_BASE_PATH = "/nome-do-repositorio" quando publicado em usuario.github.io/nome-do-repositorio
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};
