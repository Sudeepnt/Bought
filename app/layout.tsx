import type { Metadata } from 'next';
import {
  Barlow_Condensed,
  Inter,
  JetBrains_Mono,
  Newsreader,
} from 'next/font/google';
import './globals.css';
import './drop.css';
import { BoughtProvider } from '@/components/bought-provider';
import { MarketFrame } from '@/components/market-frame';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'BOUGHT — The Global Attention Exchange',
  description: 'One global auction. One daily market. Spend to be seen.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'BOUGHT',
    statusBarStyle: 'black-translucent',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try { if (localStorage.getItem('bought-theme') !== 'dark') document.documentElement.dataset.theme = 'light'; } catch { document.documentElement.dataset.theme = 'light'; }",
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${barlowCondensed.variable} ${jetBrainsMono.variable} ${newsreader.variable}`}
      >
        <BoughtProvider>
          <MarketFrame>{children}</MarketFrame>
        </BoughtProvider>
      </body>
    </html>
  );
}
