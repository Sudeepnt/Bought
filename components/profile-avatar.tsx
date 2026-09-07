const faceUrls: Record<string, string> = {
  AR: 'https://randomuser.me/api/portraits/women/44.jpg',
  AN: 'https://randomuser.me/api/portraits/women/44.jpg',
  AS: 'https://randomuser.me/api/portraits/men/32.jpg',
  PM: 'https://randomuser.me/api/portraits/women/68.jpg',
  RK: 'https://randomuser.me/api/portraits/men/75.jpg',
  KV: 'https://randomuser.me/api/portraits/men/46.jpg',
  SJ: 'https://randomuser.me/api/portraits/men/52.jpg',
  SK: 'https://randomuser.me/api/portraits/men/52.jpg',
  EC: 'https://randomuser.me/api/portraits/men/52.jpg',
  MC: 'https://randomuser.me/api/portraits/women/65.jpg',
  JB: 'https://randomuser.me/api/portraits/men/32.jpg',
  NP: 'https://randomuser.me/api/portraits/women/68.jpg',
};

export function ProfileAvatar({ initials, className = '', alt = '' }: { initials: string; className?: string; alt?: string }) {
  const src = faceUrls[initials] ?? faceUrls.AR;
  return (
    <span className={`profile-avatar ${className}`}>
      <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" />
    </span>
  );
}
