import type { AnchorHTMLAttributes } from 'react';

type SiteLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> & {
  href: string;
};

/**
 * Use a normal document navigation so links remain reliable on every host.
 * The current Vinext client router fails during Vercel RSC transitions.
 */
export default function SiteLink({ href, ...props }: SiteLinkProps) {
  return <a href={href} {...props} />;
}
