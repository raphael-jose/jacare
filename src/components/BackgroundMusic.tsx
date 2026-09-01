import { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Romantic chord progression in C major (soft pad)
const CHORDS = [
  [261.63, 329.63, 392.00], // C major
  [293.66, 369.99, 440.00], // D major
  [220.00, 277.18, 329.63], // A minor
  [246.94, 311.13, 369.99], // B minor
  [261.63, 329.63, 392.00], // C major
  [349.23, 440.00, 523.25], // F major
  [196.00, 246.94, 293.66], // G major
  [220.00, 277.18, 329.63], // A minor
];

export default function BackgroundMusic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [showControls, setShowControls] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const chordIndexRef = useRef(0);

  const playChord = useCallback((ctx: AudioContext, gain: GainNode, frequencies: number[], duration: number) => {
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      // Slight detune for warmth
      osc.detune.setValueAtTime(i * 3, ctx.currentTime);
      
      oscGain.gain.setValueAtTime(0, ctx.currentTime);
      oscGain.gain.linearRampToValueAtTime(0.12 / frequencies.length, ctx.currentTime + duration * 0.3);
      oscGain.gain.linearRampToValueAtTime(0.08 / frequencies.length, ctx.currentTime + duration * 0.7);
      oscGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
      
      osc.connect(oscGain);
      oscGain.connect(gain);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    });
  }, []);

  const startMusic = useCallback(() => {
    if (audioCtxRef.current) return;
    
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.5, ctx.currentTime);
    gain.connect(ctx.destination);
    gainRef.current = gain;
    
    const playNextChord = () => {
      const chord = CHORDS[chordIndexRef.current % CHORDS.length];
      playChord(ctx, gain, chord, 4);
      chordIndexRef.current++;
    };
    
    playNextChord();
    intervalRef.current = window.setInterval(playNextChord, 3800);
    setIsPlaying(true);
  }, [volume, playChord]);

  const stopMusic = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    gainRef.current = null;
    chordIndexRef.current = 0;
    setIsPlaying(false);
  }, []);

  const toggleMusic = useCallback(() => {
    if (isPlaying) stopMusic();
    else startMusic();
  }, [isPlaying, startMusic, stopMusic]);

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.setValueAtTime(volume * 0.5, audioCtxRef.current?.currentTime || 0);
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowControls(!showControls)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          isPlaying 
            ? 'bg-gradient-to-r from-love-400 to-love-600 text-white' 
            : 'bg-white/80 text-love-400 border-2 border-love-200'
        }`}
      >
        {isPlaying ? <Music size={20} /> : <VolumeX size={20} />}
      </motion.button>
      
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-14 left-0 bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-xl border-2 border-love-100 min-w-[140px]"
          >
            <button
              onClick={toggleMusic}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-love-600 hover:bg-love-50 transition"
            >
              {isPlaying ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {isPlaying ? 'Desligar' : 'Ligar Música'}
            </button>
            
            {isPlaying && (
              <div className="mt-2 px-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume * 100}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  className="w-full h-2 bg-love-100 rounded-full appearance-none cursor-pointer accent-love-500"
                />
                <p className="text-xs text-love-400 text-center mt-1">Volume: {Math.round(volume * 100)}%</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
