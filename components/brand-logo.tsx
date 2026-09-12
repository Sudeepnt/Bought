/* oxlint-disable next/no-img-element -- Vinext's image optimizer is not used on Vercel; these immutable local assets are pre-sized. */
type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()}>
      <img
        className="brand-logo-image brand-logo-on-dark"
        src="/brand/bought-white.png"
        width="2171"
        height="724"
        alt="BOUGHT"
      />
      <img
        className="brand-logo-image brand-logo-on-light"
        src="/brand/bought-black.png"
        width="2172"
        height="724"
        alt="BOUGHT"
      />
    </span>
  );
}
