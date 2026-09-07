export function ProfileAvatar({
  initials,
  className = '',
  alt = '',
}: {
  initials: string;
  className?: string;
  alt?: string;
}) {
  return (
    <span
      className={`profile-avatar ${className}`}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      {initials}
    </span>
  );
}
