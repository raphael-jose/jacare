import { useCallback, useRef } from 'react';

// Cute game sounds using Web Audio API
export function useSounds() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return null;
        audioCtxRef.current = new Ctx();
      }
      // Browsers suspend the context until a user gesture — resume when possible
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.2, delay = 0) => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    } catch {}
  }, [getCtx]);

  // Win sound - happy ascending melody
  const playWin = useCallback(() => {
    playTone(523, 0.15, 'sine', 0.15, 0);      // C5
    playTone(659, 0.15, 'sine', 0.15, 0.12);   // E5
    playTone(784, 0.15, 'sine', 0.15, 0.24);   // G5
    playTone(1047, 0.3, 'sine', 0.18, 0.36);   // C6

    // Sparkle overlay
    playTone(1568, 0.1, 'sine', 0.08, 0.45);
    playTone(2093, 0.1, 'sine', 0.06, 0.55);
  }, [playTone]);

  // Lose sound - gentle descending
  const playLose = useCallback(() => {
    playTone(440, 0.2, 'sine', 0.12, 0);
    playTone(370, 0.2, 'sine', 0.12, 0.2);
    playTone(311, 0.3, 'sine', 0.12, 0.4);
  }, [playTone]);

  // Wrong guess - soft bonk
  const playWrong = useCallback(() => {
    playTone(200, 0.12, 'triangle', 0.18, 0);
    playTone(150, 0.15, 'triangle', 0.12, 0.05);
  }, [playTone]);

  // Correct guess - happy pop
  const playCorrect = useCallback(() => {
    playTone(880, 0.08, 'sine', 0.14, 0);
    playTone(1100, 0.12, 'sine', 0.12, 0.06);
  }, [playTone]);

  // Card flip - soft click
  const playFlip = useCallback(() => {
    playTone(1200, 0.04, 'sine', 0.1, 0);
    playTone(800, 0.03, 'sine', 0.08, 0.02);
  }, [playTone]);

  // Match found - sparkle sound
  const playMatch = useCallback(() => {
    playTone(1047, 0.08, 'sine', 0.12, 0);
    playTone(1319, 0.08, 'sine', 0.12, 0.06);
    playTone(1568, 0.12, 'sine', 0.14, 0.12);
  }, [playTone]);

  // Level cleared - bright fanfare
  const playLevel = useCallback(() => {
    playTone(659, 0.1, 'square', 0.08, 0);
    playTone(784, 0.1, 'square', 0.08, 0.1);
    playTone(988, 0.1, 'square', 0.08, 0.2);
    playTone(1319, 0.25, 'square', 0.1, 0.3);
  }, [playTone]);

  // Draw - neutral chime
  const playDraw = useCallback(() => {
    playTone(440, 0.15, 'sine', 0.1, 0);
    playTone(440, 0.15, 'sine', 0.1, 0.2);
  }, [playTone]);

  // Chat message - soft ping
  const playMessage = useCallback(() => {
    playTone(1200, 0.06, 'sine', 0.08, 0);
    playTone(1600, 0.08, 'sine', 0.06, 0.04);
  }, [playTone]);

  // Timer warning - gentle tick
  const playTick = useCallback(() => {
    playTone(1000, 0.03, 'square', 0.05, 0);
  }, [playTone]);

  // Button click
  const playClick = useCallback(() => {
    playTone(600, 0.03, 'sine', 0.08, 0);
  }, [playTone]);

  return {
    playWin,
    playLose,
    playWrong,
    playCorrect,
    playFlip,
    playMatch,
    playLevel,
    playDraw,
    playMessage,
    playTick,
    playClick,
  };
}
