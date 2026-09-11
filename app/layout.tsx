import type { Metadata } from 'next';
import { Barlow_Condensed, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './drop.css';
import { BoughtProvider } from '@/components/bought-provider';

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

export const metadata: Metadata = {
  title: 'BOUGHT — The Global Attention Exchange',
  description: 'One global auction. One daily market. Spend to be seen.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${barlowCondensed.variable} ${jetBrainsMono.variable}`}
      >
        <BoughtProvider>{children}</BoughtProvider>
      </body>
    </html>
  );
}
