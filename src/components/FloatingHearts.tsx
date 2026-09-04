import { useEffect, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';

interface Floaty {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  type: 'heart' | 'sparkle';
}

const COLORS = ['#fda4af', '#fb7185', '#f43f5e', '#f9a8d4', '#fbbf24'];

export default function FloatingHearts() {
  const [floaties, setFloaties] = useState<Floaty[]>([]);

  useEffect(() => {
    const items = Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 12 + Math.random() * 14,
      size: 12 + Math.random() * 18,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      type: (Math.random() < 0.8 ? 'heart' : 'sparkle') as 'heart' | 'sparkle',
    }));
    setFloaties(items);
  }, []);

  return (
    <div className="floating-hearts">
      {floaties.map((f) => {
        const Icon = f.type === 'heart' ? Heart : Sparkles;
        return (
          <span
            key={f.id}
            className="heart"
            style={{
              left: `${f.left}%`,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.duration}s`,
            }}
          >
            <Icon
              style={{ width: f.size, height: f.size }}
              fill={f.type === 'heart' ? f.color : 'none'}
              color={f.color}
            />
          </span>
        );
      })}
    </div>
  );
}
