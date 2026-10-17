import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'My Next.js App',
    short_name: 'MyApp',
    description: 'My installable web application',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#173f35',
    icons: [
      {
        src: '/icons/web_logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/web_logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
