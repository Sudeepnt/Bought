import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BOUGHT — Join the Waitlist',
  description:
    'Join the early-access list for BOUGHT, the global attention exchange built on one auction and one public ladder.',
};

export default function WaitlistLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
