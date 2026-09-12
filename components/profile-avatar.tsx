export function ProfileAvatar({
  initials,
  className = '',
  alt = '',
  imageSrc,
  imagePosition = 'center',
  imageMode = 'sprite',
}: {
  initials: string;
  className?: string;
  alt?: string;
  imageSrc?: string;
  imagePosition?: string;
  imageMode?: 'sprite' | 'cover';
}) {
  const imageStyle = imageSrc
    ? {
        backgroundImage: `url(${imageSrc})`,
        backgroundPosition: imagePosition,
        backgroundSize: imageMode === 'cover' ? 'cover' : '500% 200%',
      }
    : undefined;

  return (
    <span
      className={`profile-avatar ${className}`}
      style={imageStyle}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      {imageSrc ? null : initials}
    </span>
  );
}
