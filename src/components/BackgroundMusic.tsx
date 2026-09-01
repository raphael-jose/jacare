import { useState, useEffect } from 'react';
import { Music, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BackgroundMusic() {
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    const handler = () => setShowPlayer(true);
    window.addEventListener('toggle-music', handler);
    return () => window.removeEventListener('toggle-music', handler);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowPlayer(!showPlayer)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          showPlayer
            ? 'bg-gradient-to-r from-love-400 to-love-600 text-white'
            : 'bg-white/80 text-love-400 border-2 border-love-200'
        }`}
      >
        {showPlayer ? <X size={20} /> : <Music size={20} />}
      </motion.button>

      <AnimatePresence>
        {showPlayer && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-14 left-0 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border-2 border-love-100 overflow-hidden"
            style={{ width: 320 }}
          >
            <div className="p-3 bg-gradient-to-r from-love-400 to-love-600 text-white">
              <p className="font-bold text-sm">🎵 Gustavo Mioto - Românticas</p>
              <p className="text-xs text-love-100">Toque no play e curtam juntos! 💕</p>
            </div>
            <iframe
              src="https://open.spotify.com/embed/playlist/78CYw5FKxxxHPcvYhiZWNi?utm_source=generator&theme=0"
              width="320"
              height="380"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ borderRadius: '0 0 12px 12px' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
