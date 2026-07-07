import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Kleen Works - Car Wash Management',
  description: 'Intelligent Car Wash Management System',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icon-180.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#00A8CC',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: apply theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('sf-theme');
            const p = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            if ((t || p) === 'dark') document.documentElement.classList.add('dark');
          } catch(e) {}
        `}} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background min-h-screen text-foreground">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}