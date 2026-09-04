import { motion } from 'framer-motion';
import {
  Heart, Star, Music, Gift, Cake, Moon, Sun, Sparkles, Zap, Flower2,
  Coffee, PawPrint, Bird, Ghost, Crown, Rocket,
} from 'lucide-react';

export interface AvatarOption {
  key: string;
  name: string;
  icon: any;
  bg: string;
}

export const AVATARS: AvatarOption[] = [
  { key: 'heart-rose', name: 'Coracao', icon: Heart, bg: 'from-rose-400 to-pink-500' },
  { key: 'star-amber', name: 'Estrela', icon: Star, bg: 'from-amber-400 to-orange-500' },
  { key: 'music-violet', name: 'Musica', icon: Music, bg: 'from-violet-400 to-purple-500' },
  { key: 'gift-emerald', name: 'Presente', icon: Gift, bg: 'from-emerald-400 to-teal-500' },
  { key: 'cake-pink', name: 'Bolo', icon: Cake, bg: 'from-pink-400 to-rose-500' },
  { key: 'moon-indigo', name: 'Lua', icon: Moon, bg: 'from-indigo-400 to-blue-500' },
  { key: 'sun-amber', name: 'Sol', icon: Sun, bg: 'from-yellow-400 to-amber-500' },
  { key: 'sparkles-fuchsia', name: 'Brilho', icon: Sparkles, bg: 'from-fuchsia-400 to-pink-500' },
  { key: 'zap-yellow', name: 'Raio', icon: Zap, bg: 'from-yellow-400 to-orange-400' },
  { key: 'flower-cyan', name: 'Flor', icon: Flower2, bg: 'from-cyan-400 to-sky-500' },
  { key: 'coffee-amber', name: 'Cafe', icon: Coffee, bg: 'from-amber-500 to-orange-600' },
  { key: 'paw-lime', name: 'Patas', icon: PawPrint, bg: 'from-lime-400 to-green-500' },
  { key: 'bird-sky', name: 'Passarinho', icon: Bird, bg: 'from-sky-400 to-blue-500' },
  { key: 'ghost-indigo', name: 'Fantasma', icon: Ghost, bg: 'from-indigo-400 to-violet-500' },
  { key: 'crown-amber', name: 'Coroa', icon: Crown, bg: 'from-amber-400 to-yellow-500' },
  { key: 'rocket-rose', name: 'Foguete', icon: Rocket, bg: 'from-rose-500 to-red-500' },
];

export const DEFAULT_AVATAR = AVATARS[0].key;

interface AvatarPickerProps {
  selected: string;
  onSelect: (key: string) => void;
}

export default function AvatarPicker({ selected, onSelect }: AvatarPickerProps) {
  return (
    <div>
      <label className="block text-sm font-bold text-love-600 mb-2">Seu avatar</label>
      <div className="grid grid-cols-8 gap-2">
        {AVATARS.map((avatar) => {
          const Icon = avatar.icon;
          return (
            <motion.button
              key={avatar.key}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onSelect(avatar.key)}
              title={avatar.name}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white
                         bg-gradient-to-br transition-all duration-200 ${avatar.bg}
                         ${selected === avatar.key
                           ? 'shadow-lg ring-2 ring-love-400 ring-offset-2'
                           : 'opacity-80 hover:opacity-100 border border-black/5'
                         }`}
            >
              <Icon style={{ width: '55%', height: '55%' }} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
