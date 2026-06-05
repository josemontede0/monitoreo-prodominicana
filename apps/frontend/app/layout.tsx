import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MonitoreoApp ProDominicana',
  description: 'Sistema de monitoreo de servicios digitales de ProDominicana',
  icons: { icon: '/favicon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-gray-950 text-white min-h-screen">{children}</body>
    </html>
  );
}