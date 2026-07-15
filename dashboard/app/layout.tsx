import type { Metadata } from 'next';
import { Bebas_Neue, IBM_Plex_Mono, Outfit } from 'next/font/google';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-ibm-mono',
  display: 'swap',
});

const outfit = Outfit({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Recovo — Coach Dashboard',
  description: 'Elite athlete performance platform by Recovo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className={`${bebasNeue.variable} ${ibmPlexMono.variable} ${outfit.variable} antialiased`}
        style={{ background: 'var(--bg2)', color: 'var(--text1)' }}>
        {children}
      </body>
    </html>
  );
}
