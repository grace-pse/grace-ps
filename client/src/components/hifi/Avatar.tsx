interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const SIZES = { sm: 'w-5 h-5 text-[9.5px]', md: 'w-7 h-7 text-[11px]', lg: 'w-9 h-9 text-[13px]' };

export function Avatar({ name, size = 'md' }: AvatarProps) {
  return (
    <span
      aria-label={name}
      className={[
        'inline-flex items-center justify-center rounded-full font-semibold bg-a-100 text-a-700',
        SIZES[size],
      ].join(' ')}
    >
      {initials(name) || '?'}
    </span>
  );
}
