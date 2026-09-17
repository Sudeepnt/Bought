import { Link2 } from 'lucide-react';
import type { ReactNode, SVGProps } from 'react';

export type SocialIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type SocialBrandIcon = (props: SocialIconProps) => ReactNode;

function BrandSvg({
  children,
  size,
  ...props
}: SocialIconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function XBrandIcon(props: SocialIconProps) {
  return (
    <BrandSvg {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </BrandSvg>
  );
}

export function InstagramBrandIcon(props: SocialIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height={props.size}
      viewBox="0 0 24 24"
      width={props.size}
      {...props}
    >
      <rect
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
        width="18"
        x="3"
        y="3"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" fill="currentColor" r="1" stroke="none" />
    </svg>
  );
}

export function LinkedInBrandIcon(props: SocialIconProps) {
  return (
    <BrandSvg {...props}>
      <path d="M20.447 20.5h-3.708v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939V20.5H9.04v-12h3.559v1.64h.05c.497-.94 1.709-1.93 3.518-1.93 3.757 0 4.45 2.473 4.45 5.69v6.6zM4.86 6.86a2.15 2.15 0 1 1 0-4.3 2.15 2.15 0 0 1 0 4.3M3 8.5h3.72v12H3z" />
    </BrandSvg>
  );
}

export function YouTubeBrandIcon(props: SocialIconProps) {
  return (
    <BrandSvg {...props}>
      <path d="M23.498 6.186a2.997 2.997 0 0 0-2.11-2.12C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.52a2.997 2.997 0 0 0-2.11 2.12C0 8.07 0 12 0 12s0 3.93.502 5.814a2.997 2.997 0 0 0 2.11 2.12c1.883.52 9.388.52 9.388.52s7.505 0 9.388-.52a2.997 2.997 0 0 0 2.11-2.12C24 15.93 24 12 24 12s0-3.93-.502-5.814M9.545 15.568V8.432L15.818 12z" />
    </BrandSvg>
  );
}

export function TikTokBrandIcon(props: SocialIconProps) {
  return (
    <BrandSvg {...props}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.16-5.91 3.2-1.43.08-2.86-.31-4.08-1.03-2.02-1.17-3.44-3.37-3.65-5.69-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.76-.21.51-.15 1.07-.14 1.59.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.9.06-3.79.07-5.69.01-4.28-.01-8.56.02-12.84z" />
    </BrandSvg>
  );
}

const PLATFORM_ICONS: Record<string, SocialBrandIcon> = {
  x: XBrandIcon,
  instagram: InstagramBrandIcon,
  linkedin: LinkedInBrandIcon,
  youtube: YouTubeBrandIcon,
  tiktok: TikTokBrandIcon,
  website: Link2,
};

export function SocialPlatformIcon({
  platform,
  ...props
}: SocialIconProps & { platform: string }) {
  const Icon = PLATFORM_ICONS[platform.trim().toLowerCase()] ?? Link2;
  return <Icon {...props} />;
}
