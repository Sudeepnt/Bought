'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { MarketTopbar, type MarketPage } from '@/components/market-topbar';

function activePage(pathname: string): MarketPage {
  if (pathname.startsWith('/categories')) return 'categories';
  if (pathname.startsWith('/newspaper')) return 'newspaper';
  if (pathname.startsWith('/watchlist')) return 'watchlist';
  if (pathname.startsWith('/how-it-works')) return 'rules';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/broadcast')) return 'broadcast';
  if (pathname.startsWith('/capture-test')) return 'broadcast';
  if (pathname.startsWith('/review')) return 'review';
  if (pathname.startsWith('/terms')) return 'terms';
  return 'floor';
}

/* The header, wire tape and bidding bar live here once, above every route, so
   changing page only swaps the content underneath. */
export function MarketFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return (
    <div
      className={`market-shell dashboard-shell today-edition market-frame${pathname === '/' ? ' is-home' : ''}${pathname.startsWith('/categories') ? ' is-categories' : ''}`}
    >
      <MarketTopbar active={activePage(pathname)} />
      {children}
    </div>
  );
}
