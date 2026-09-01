import { useEffect, useState } from 'react';

interface Heart {
  id: number;
  left: number;
  delay: number;
  duration: number;
  emoji: string;
}

const heartEmojis = ['💕', '💗', '💖', '💘', '💝', '✨', '🌸'];

export default function FloatingHearts() {
  const [hearts, setHearts] = useState<Heart[]>([]);

  useEffect(() => {
    const initialHearts = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 10 + Math.random() * 15,
      emoji: heartEmojis[Math.floor(Math.random() * heartEmojis.length)],
    }));
    setHearts(initialHearts);
  }, []);

  return (
    <div className="floating-hearts">
      {hearts.map((heart) => (
        <span
          key={heart.id}
          className="heart"
          style={{
            left: `${heart.left}%`,
            animationDelay: `${heart.delay}s`,
            animationDuration: `${heart.duration}s`,
            fontSize: `${16 + Math.random() * 24}px`,
          }}
        >
          {heart.emoji}
        </span>
      ))}
    </div>
  );
}
