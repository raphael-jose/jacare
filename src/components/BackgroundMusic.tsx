import { useState, useEffect, useRef, useCallback } from 'react';
import { Music, X, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../contexts/SocketContext';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const PLAYLIST_ID = 'PL0ao6cotJFFUyWGfYx1jCnQHtpshpg3A5';

export default function BackgroundMusic() {
  const [showPlayer, setShowPlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const volumeTimeout = useRef<any>(null);
  const { emit, on } = useSocket();

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      createPlayer();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      createPlayer();
    };
  }, []);

  const createPlayer = useCallback(() => {
    if (!containerRef.current || playerRef.current) return;
    playerRef.current = new window.YT.Player(containerRef.current, {
      height: '1',
      width: '1',
      playerVars: {
        listType: 'playlist',
        list: PLAYLIST_ID,
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        rel: 0,
        volume: 50,
      },
      events: {
        onReady: () => {
          setPlayerReady(true);
          playerRef.current.setVolume(50);
        },
        onStateChange: (event: any) => {
          if (event.data === 1) setIsPlaying(true);
          else if (event.data === 2) setIsPlaying(false);
        },
      },
    });
  }, []);

  // Socket listeners for shared control
  useEffect(() => {
    const unsub1 = on('music:play', () => playerRef.current?.playVideo?.());
    const unsub2 = on('music:pause', () => playerRef.current?.pauseVideo?.());
    const unsub3 = on('music:next', () => playerRef.current?.nextVideo?.());
    const unsub4 = on('music:prev', () => playerRef.current?.previousVideo?.());
    const unsub5 = on('music:volume', (data: { volume: number }) => {
      if (playerRef.current?.setVolume) {
        playerRef.current.setVolume(data.volume);
        setVolume(data.volume);
        if (data.volume > 0 && playerRef.current.isMuted?.()) playerRef.current.unMute();
      }
    });
    const unsub6 = on('music:mute', () => { playerRef.current?.mute?.(); setIsMuted(true); });
    const unsub7 = on('music:unmute', () => { playerRef.current?.unMute?.(); setIsMuted(false); });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); };
  }, [on]);

  useEffect(() => {
    const handler = () => setShowPlayer(true);
    window.addEventListener('toggle-music', handler);
    return () => window.removeEventListener('toggle-music', handler);
  }, []);

  const safe = (fn: () => void) => { if (playerReady && playerRef.current) fn(); };

  const handlePlay = () => { safe(() => { playerRef.current.playVideo(); emit('music:play'); }); };
  const handlePause = () => { safe(() => { playerRef.current.pauseVideo(); emit('music:pause'); }); };
  const handleNext = () => { safe(() => { playerRef.current.nextVideo(); emit('music:next'); }); };
  const handlePrev = () => { safe(() => { playerRef.current.previousVideo(); emit('music:prev'); }); };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
    volumeTimeout.current = setTimeout(() => {
      safe(() => {
        playerRef.current.setVolume(newVol);
        if (newVol > 0 && isMuted) { playerRef.current.unMute(); setIsMuted(false); }
        if (newVol === 0) { playerRef.current.mute(); setIsMuted(true); }
        emit('music:volume', { volume: newVol });
      });
    }, 100);
  };

  const handleMute = () => {
    if (isMuted) {
      safe(() => { playerRef.current.unMute(); playerRef.current.setVolume(volume || 50); });
      setIsMuted(false);
      emit('music:unmute');
    } else {
      safe(() => { playerRef.current.mute(); });
      setIsMuted(true);
      emit('music:mute');
    }
  };

  return (
    <>
      <div ref={containerRef} style={{ position: 'fixed', left: 0, top: 0, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }} />

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
        <AnimatePresence>
          {showPlayer && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="mb-3 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border-2 border-love-100 p-3"
              style={{ width: 280 }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-xs text-love-600 flex items-center gap-1">
                  <Music size={13} /> Gustavo Mioto
                </p>
                <button onClick={() => setShowPlayer(false)} className="text-love-300 hover:text-love-500">
                  <X size={14} />
                </button>
              </div>

              <p className="text-[10px] text-love-400 text-center mb-2">Controle compartilhado</p>

              {/* Transport controls */}
              <div className="flex items-center justify-center gap-3 mb-3">
                <button onClick={handlePrev} className="w-9 h-9 rounded-full bg-love-50 text-love-500 flex items-center justify-center hover:bg-love-100 transition">
                  <SkipBack size={16} />
                </button>
                <button onClick={isPlaying ? handlePause : handlePlay}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-love-400 to-love-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition">
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                <button onClick={handleNext} className="w-9 h-9 rounded-full bg-love-50 text-love-500 flex items-center justify-center hover:bg-love-100 transition">
                  <SkipForward size={16} />
                </button>
              </div>

              {/* Volume slider */}
              <div className="flex items-center gap-2 px-2">
                <button onClick={handleMute} className="text-love-400 hover:text-love-600 transition flex-shrink-0">
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-love-100 rounded-full appearance-none cursor-pointer accent-love-500"
                  style={{ accentColor: '#f43f5e' }}
                />
                <span className="text-[10px] text-love-400 w-7 text-right">{isMuted ? 0 : volume}%</span>
              </div>

              <p className="text-[10px] text-love-300 text-center mt-2">Ambos controlam a mesma musica</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowPlayer(!showPlayer)}
          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            isPlaying
              ? 'bg-gradient-to-r from-love-400 to-love-600 text-white animate-pulse'
              : 'bg-white/80 text-love-400 border-2 border-love-200'
          }`}
        >
          {showPlayer ? <X size={18} /> : <Music size={18} />}
        </motion.button>
      </div>
    </>
  );
}
