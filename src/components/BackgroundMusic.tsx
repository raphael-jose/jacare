import { useState, useEffect } from 'react';
import { Music, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BackgroundMusic() {
  const [showPlayer, setShowPlayer] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const handler = () => { setShowPlayer(true); setHasStarted(true); };
    window.addEventListener('toggle-music', handler);
    return () => window.removeEventListener('toggle-music', handler);
  }, []);

  const togglePlayer = () => {
    if (!hasStarted) setHasStarted(true);
    setShowPlayer(!showPlayer);
  };

  return (
    <>
      {/* Always-mounted hidden iframe to keep music playing */}
      {hasStarted && (
        <div className="fixed -left-[9999px] -top-[9999px] w-0 h-0 opacity-0 pointer-events-none">
          <iframe
            src="https://www.youtube.com/embed/videoseries?list=PL0ao6cotJFFUyWGfYx1jCnQHtpshpg3A5&autoplay=1&mute=0"
            width="1"
            height="1"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Toggle button - bottom center to avoid overlapping */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
        <AnimatePresence>
          {showPlayer && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="mb-3 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border-2 border-love-100 overflow-hidden"
              style={{ width: 300 }}
            >
              <div className="p-2 bg-gradient-to-r from-love-400 to-love-600 text-white flex items-center justify-between">
                <p className="font-bold text-xs">🎵 Gustavo Mioto</p>
                <button onClick={() => setShowPlayer(false)} className="text-white/80 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <iframe
                src="https://www.youtube.com/embed/videoseries?list=PL0ao6cotJFFUyWGfYx1jCnQHtpshpg3A5&autoplay=0"
                width="300"
                height="180"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ borderRadius: '0 0 12px 12px' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={togglePlayer}
          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            hasStarted
              ? 'bg-gradient-to-r from-love-400 to-love-600 text-white'
              : 'bg-white/80 text-love-400 border-2 border-love-200'
          }`}
        >
          {showPlayer ? <X size={18} /> : <Music size={18} />}
        </motion.button>
      </div>
    </>
  );
}
