import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Check, Heart, Users } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

const gameNames: Record<string, string> = {
  tictactoe: 'Jogo da Velha 💕',
  hangman: 'Jogo da Forca 💝',
  memory: 'Jogo da Memória 💗',
  words: 'Jogo de Palavras 💘',
};

const gameEmojis: Record<string, string> = {
  tictactoe: '❌⭕',
  hangman: '🎯',
  memory: '🧠',
  words: '✍️',
};

export default function Lobby() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsub1 = on('room:created', (data: { roomId: string }) => {
      setRoomCode(data.roomId);
      setWaiting(true);
    });

    const unsub2 = on('room:joined', (data: { roomId: string }) => {
      navigate(`/game/${gameType}/${data.roomId}?name=${encodeURIComponent(playerName)}`);
    });

    const unsub3 = on('room:error', (data: { message: string }) => {
      alert(data.message);
      setWaiting(false);
      setIsCreating(false);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [gameType, playerName, navigate, on]);

  const createRoom = () => {
    if (!playerName.trim()) return;
    setIsCreating(true);
    emit('room:create', { gameType, playerName: playerName.trim() });
  };

  const joinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    emit('room:join', { 
      roomId: roomCode.trim().toUpperCase(), 
      gameType, 
      playerName: playerName.trim() 
    });
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    const shareData = {
      title: `Vem jogar ${gameNames[gameType || '']} comigo! 💕`,
      text: `Entre na sala: ${roomCode}\n\nJogo: ${gameNames[gameType || '']}\n\nAbra o link e digite o código! 🎮`,
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      copyCode();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Back button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-love-600 font-bold"
        >
          <ArrowLeft size={20} />
          Voltar
        </motion.button>

        {/* Game title */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="text-center mb-8"
        >
          <span className="text-5xl mb-4 block animate-bounce-slow">
            {gameEmojis[gameType || '']}
          </span>
          <h1 className="text-3xl font-black text-love-700 mb-2">
            {gameNames[gameType || '']}
          </h1>
          <p className="text-love-500">Jogue com seu amor de qualquer lugar! 🏠💕</p>
        </motion.div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-love-200/30 border-2 border-love-100">
          {/* Name input */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-love-600 mb-2">
              Seu nome 💕
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Como seu amor te chama?"
              className="input-love"
              maxLength={20}
            />
          </div>

          <AnimatePresence mode="wait">
            {!waiting ? (
              <motion.div
                key="actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Create room */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={createRoom}
                  disabled={!playerName.trim()}
                  className="w-full btn-love mb-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Heart size={20} />
                  Criar Sala
                </motion.button>

                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-px bg-love-200" />
                  <span className="text-love-400 font-bold text-sm">OU</span>
                  <div className="flex-1 h-px bg-love-200" />
                </div>

                {/* Join room */}
                <div className="space-y-3">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Código da sala"
                    className="input-love text-center text-lg font-bold tracking-widest uppercase"
                    maxLength={6}
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={joinRoom}
                    disabled={!playerName.trim() || !roomCode.trim()}
                    className="w-full btn-outline flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Users size={20} />
                    Entrar na Sala
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-4"
              >
                {/* Room code display */}
                <p className="text-sm text-love-500 mb-2">Código da sala:</p>
                <div className="bg-gradient-to-r from-love-50 to-love-100 rounded-2xl p-4 mb-4 border-2 border-love-200">
                  <span className="text-4xl font-black text-love-600 tracking-[0.3em]">
                    {roomCode}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mb-6">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={copyCode}
                    className="flex-1 btn-outline flex items-center justify-center gap-2 text-sm"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={shareCode}
                    className="flex-1 btn-love flex items-center justify-center gap-2 text-sm"
                  >
                    📤 Compartilhar
                  </motion.button>
                </div>

                {/* Waiting animation */}
                <div className="flex flex-col items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="text-3xl"
                  >
                    ⏳
                  </motion.div>
                  <p className="text-love-500 font-bold">
                    Esperando seu amor entrar...
                  </p>
                  <p className="text-love-400 text-sm">
                    Envie o código para seu parceiro! 💕
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
