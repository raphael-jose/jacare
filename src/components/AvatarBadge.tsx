import { AVATARS } from './AvatarPicker';

interface AvatarBadgeProps {
  avatar?: string;
  name?: string;
  size?: number;
  className?: string;
}

// Renders the player's avatar as a colored icon tile. Falls back to a
// letter tile for legacy emoji avatars or missing data (no emojis in the UI).
export default function AvatarBadge({ avatar, name, size = 32, className = '' }: AvatarBadgeProps) {
  const option = AVATARS.find(a => a.key === avatar);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 ${
        option ? `bg-gradient-to-br ${option.bg}` : 'bg-gradient-to-br from-love-300 to-love-500'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {option ? (
        <option.icon style={{ width: '55%', height: '55%' }} className="text-white" />
      ) : (
        <span className="text-white font-black pixel-font" style={{ fontSize: size * 0.42 }}>
          {initial}
        </span>
      )}
    </div>
  );
}
