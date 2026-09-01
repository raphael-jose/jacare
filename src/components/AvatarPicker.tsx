import { motion } from 'framer-motion';

const AVATARS = [
  { emoji: '🐱', name: 'Gatinho' },
  { emoji: '🐶', name: 'Cachorrinho' },
  { emoji: '🐰', name: 'Coelhinho' },
  { emoji: '🐻', name: 'Urso' },
  { emoji: '🦊', name: 'Raposa' },
  { emoji: '🐼', name: 'Panda' },
  { emoji: '🦄', name: 'Unicórnio' },
  { emoji: '🦋', name: 'Borboleta' },
  { emoji: '🌸', name: 'Flor' },
  { emoji: '🍓', name: 'Morango' },
  { emoji: '🌙', name: 'Lua' },
  { emoji: '⭐', name: 'Estrela' },
  { emoji: '🎵', name: 'Musica' },
  { emoji: '🎮', name: 'Game' },
  { emoji: '💖', name: 'Coração' },
  { emoji: '🔥', name: 'Foguinho' },
];

interface AvatarPickerProps {
  selected: string;
  onSelect: (emoji: string) => void;
}

export default function AvatarPicker({ selected, onSelect }: AvatarPickerProps) {
  return (
    <div>
      <label className="block text-sm font-bold text-love-600 mb-2">Seu avatar 💕</label>
      <div className="grid grid-cols-8 gap-2">
        {AVATARS.map((avatar) => (
          <motion.button
            key={avatar.emoji}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSelect(avatar.emoji)}
            title={avatar.name}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl
                       transition-all duration-200
                       ${selected === avatar.emoji
                         ? 'bg-love-500 shadow-lg shadow-love-300/50 ring-2 ring-love-300'
                         : 'bg-love-50 hover:bg-love-100 border border-love-100'
                       }`}
          >
            {avatar.emoji}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export { AVATARS };
