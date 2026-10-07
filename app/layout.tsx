import type { Metadata, Viewport } from 'next';
import '@/styles/stage.css';
import '@/styles/admin.css';
import '@/styles/panel.css';

export const metadata: Metadata = { title: 'Smashr', description: 'Marcador de pádel en tiempo real' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,500;0,600;0,700;0,800;1,600;1,700;1,800&family=Barlow:wght@400;500;600;700&family=Oswald:wght@500;600;700&family=Rajdhani:wght@500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
