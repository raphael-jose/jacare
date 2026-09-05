import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Music, X, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Users, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../contexts/SocketContext';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const PLAYLIST_ID = 'PL0ao6cotJFFUyWGfYx1jCnQHtpshpg3A5';
const SHARED_KEY = 'lovegames:musicShared';

function getRoomIdFromPath(path: string): string {
  const m = path.match(/\/(?:room|game\/[^/]+)\/([A-Za-z0-9]+)/);
  return m ? m[1] : '';
}

export default function BackgroundMusic() {
  const location = useLocation();
  const roomId = getRoomIdFromPath(location.pathname);
  const inRoom = !!roomId;

  const [showPlayer, setShowPlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [playerReady, setPlayerReady] = useState(false);
  const [shared, setShared] = useState<boolean>(() => localStorage.getItem(SHARED_KEY) !== '0');

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const volumeTimeout = useRef<any>(null);
  const syncTimer = useRef<any>(null);

  // Refs so callbacks always see the current mode without re-subscribing
  const sharedRef = useRef(shared);
  const roomIdRef = useRef(roomId);
  useEffect(() => { sharedRef.current = shared; }, [shared]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

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

  // ---- Sync engine ----
  // Pushes our current track + position + playing state so the partner mirrors us.
  const pushSync = useCallback(() => {
    if (!sharedRef.current || !roomIdRef.current) return;
    const p = playerRef.current;
    if (!p || !playerReady) return;
    const videoId = p.getVideoData?.()?.video_id || '';
    if (!videoId) return;
    const time = Math.round(p.getCurrentTime?.() || 0);
    const playing = p.getPlayerState?.() === 1;
    emit('music:sync', { roomId: roomIdRef.current, videoId, time, playing });
  }, [playerReady, emit]);

  // Debounced push (next/prev need a moment to actually load the new track)
  const syncSoon = useCallback((ms = 700) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(pushSync, ms);
  }, [pushSync]);

  // Sends a simple control event only when sharing is ON and we're in a room
  const sendCtrl = useCallback((event: string) => {
    if (sharedRef.current && roomIdRef.current) {
      emit(event, { roomId: roomIdRef.current });
    }
  }, [emit]);

  // Periodic re-sync while both are listening together (fixes small drifts)
  useEffect(() => {
    if (!shared || !roomId || !isPlaying) return;
    const id = setInterval(pushSync, 10000);
    return () => clearInterval(id);
  }, [shared, roomId, isPlaying, pushSync]);

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

    // Full-state sync from the partner: same track, same second, same play/pause
    const unsub8 = on('music:sync', (data: { videoId?: string; time?: number; playing?: boolean }) => {
      const p = playerRef.current;
      if (!p || !playerReady || !data?.videoId) return;
      try {
        const cur = p.getVideoData?.()?.video_id || '';
        if (cur !== data.videoId) {
          p.loadVideoById(data.videoId);
          if (data.time) p.seekTo(data.time, true);
        } else {
          const t = p.getCurrentTime?.() || 0;
          if (data.time && Math.abs(t - data.time) > 2) p.seekTo(data.time, true);
        }
        const st = p.getPlayerState?.();
        if (data.playing && st !== 1) p.playVideo();
        else if (!data.playing && st === 1) p.pauseVideo();
      } catch {
        // ignore — player may still be loading
      }
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8(); };
  }, [on, playerReady]);

  useEffect(() => {
    const handler = () => setShowPlayer(true);
    window.addEventListener('toggle-music', handler);
    return () => window.removeEventListener('toggle-music', handler);
  }, []);

  const safe = (fn: () => void) => { if (playerReady && playerRef.current) fn(); };

  const handlePlay = () => { safe(() => { playerRef.current.playVideo(); }); sendCtrl('music:play'); syncSoon(600); };
  const handlePause = () => { safe(() => { playerRef.current.pauseVideo(); }); sendCtrl('music:pause'); syncSoon(250); };
  const handleNext = () => { safe(() => { playerRef.current.nextVideo(); }); sendCtrl('music:next'); syncSoon(1300); };
  const handlePrev = () => { safe(() => { playerRef.current.previousVideo(); }); sendCtrl('music:prev'); syncSoon(1300); };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
    volumeTimeout.current = setTimeout(() => {
      safe(() => {
        playerRef.current.setVolume(newVol);
        if (newVol > 0 && isMuted) { playerRef.current.unMute(); setIsMuted(false); }
        if (newVol === 0) { playerRef.current.mute(); setIsMuted(true); }
        if (sharedRef.current && roomIdRef.current) {
          emit('music:volume', { roomId: roomIdRef.current, volume: newVol });
        }
      });
    }, 100);
  };

  const handleMute = () => {
    if (isMuted) {
      safe(() => { playerRef.current.unMute(); playerRef.current.setVolume(volume || 50); });
      setIsMuted(false);
      sendCtrl('music:unmute');
    } else {
      safe(() => { playerRef.current.mute(); });
      setIsMuted(true);
      sendCtrl('music:mute');
    }
  };

  const toggleShared = (value: boolean) => {
    setShared(value);
    localStorage.setItem(SHARED_KEY, value ? '1' : '0');
    // When enabling, push our current track so the partner aligns right away
    if (value && roomIdRef.current) {
      setTimeout(() => {
        pushSync();
        syncSoon(1200);
      }, 900);
    }
  };

  const segCls = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg transition ` +
    (active ? 'bg-white text-love-600 shadow-sm' : 'text-love-400 hover:text-love-600');

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

              <p className="text-[10px] text-love-400 text-center mb-2">
                {!inRoom
                  ? 'Musica pessoal'
                  : shared
                    ? 'Sincronizado — os dois ouvem juntos'
                    : 'Modo solo — so voce controla'}
              </p>

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

              {/* Shared toggle */}
              {inRoom && (
                <div className="mt-2.5">
                  <div className="flex items-center gap-1 bg-love-50 rounded-xl p-1">
                    <button onClick={() => toggleShared(false)} className={segCls(!shared)}>
                      <User size={12} /> So eu
                    </button>
                    <button onClick={() => toggleShared(true)} className={segCls(shared)}>
                      <Users size={12} /> Juntos
                    </button>
                  </div>
                  <p className="text-[10px] text-love-300 text-center mt-1.5">
                    {shared
                      ? 'Toque em um celular — a musica toca nos dois'
                      : 'Cada um escuta a sua'}
                  </p>
                </div>
              )}
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
