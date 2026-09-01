import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Sparkles, Users, Plus } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import AvatarPicker from '../components/AvatarPicker';
import { showError } from '../utils/alert';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { emit, on } = useSocket();
  
  const joinCode = searchParams.get('join')?.toUpperCase() || '';
  const isInvite = !!joinCode;

  const [playerName, setPlayerName] = useState('');
  const [avatar, setAvatar] = useState('🐱');
  const [roomCode, setRoomCode] = useState(joinCode);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const unsub1 = on('room:created', (data: { roomId: string }) => {
      navigate(`/room/${data.roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}&creator=1`);
    });

    const unsub2 = on('room:error', (data: { message: string }) => {
      showError(data.message);
      setIsJoining(false);
    });

    return () => { unsub1(); unsub2(); };
  }, [playerName, navigate, on]);

  const createRoom = () => {
    if (!playerName.trim()) return;
    setIsJoining(true);
    emit('room:create', { playerName: playerName.trim() });
  };

  const joinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    navigate(`/room/${roomCode.trim().toUpperCase()}?name=${encodeURIComponent(playerName.trim())}&avatar=${encodeURIComponent(avatar)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block mb-4"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-love-400 to-love-600 flex items-center justify-center shadow-lg shadow-love-300/50">
              <Heart className="w-10 h-10 text-white" fill="white" />
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-black text-love-700 mb-2">Love Games</h1>
          <p className="text-love-500 font-bold text-lg">
            {isInvite ? 'Entre na sala do seu amor! 💕' : 'Jogos fofos para jogar com seu amor 💕'}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-love-400 text-sm">
            <Sparkles size={14} />
            <span>Multiplayer online</span>
            <Sparkles size={14} />
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          variants={itemVariants}
          className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-love-200/30 border-2 border-love-100"
        >
          {/* Name input */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-love-600 mb-2">Seu nome 💕</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Como seu amor te chama?"
              className="input-love"
              maxLength={20}
              onKeyPress={(e) => e.key === 'Enter' && !isJoining && joinRoom()}
            />
          </div>

          {/* Avatar picker */}
          <div className="mb-6">
            <AvatarPicker selected={avatar} onSelect={setAvatar} />
          </div>

          {isInvite ? (
            /* INVITE MODE: Only show join button */
            <>
              <div className="bg-love-50 rounded-2xl p-4 mb-4 border-2 border-love-200 text-center">
                <p className="text-sm text-love-500 font-bold mb-1">Código da sala:</p>
                <span className="text-3xl font-black text-love-600 tracking-[0.3em]">{roomCode}</span>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={joinRoom}
                disabled={!playerName.trim() || isJoining}
                className="w-full btn-love flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Users size={20} />
                Entrar na Sala
              </motion.button>
            </>
          ) : (
            /* NORMAL MODE: Show both create and join */
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={createRoom}
                disabled={!playerName.trim() || isJoining}
                className="w-full btn-love mb-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={20} />
                Criar Sala
              </motion.button>

              <div className="flex items-center gap-4 my-4">
                <div className="flex-1 h-px bg-love-200" />
                <span className="text-love-400 font-bold text-sm">OU</span>
                <div className="flex-1 h-px bg-love-200" />
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Codigo da sala"
                  className="input-love text-center text-lg font-bold tracking-widest uppercase"
                  maxLength={6}
                  onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
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
            </>
          )}
        </motion.div>

        {/* How it works (only in normal mode) */}
        {!isInvite && (
          <motion.div variants={itemVariants} className="mt-6 bg-white/60 backdrop-blur-sm rounded-3xl p-5 border-2 border-love-100">
            <h3 className="font-bold text-love-700 text-sm mb-3 text-center">Como funciona? 🤔</h3>
            <div className="space-y-2 text-sm text-love-600">
              <div className="flex items-start gap-3">
                <span className="text-lg">1️⃣</span>
                <p>Crie uma sala e envie o codigo para seu parceiro</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">2️⃣</span>
                <p>Quando os dois entrarem, escolham um jogo juntos</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">3️⃣</span>
                <p>Joguem e se divirtam! Tem chat tambem! 💬</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div variants={itemVariants} className="text-center mt-6 text-love-400 text-sm">
          <p className="flex items-center justify-center gap-2">
            Feito com <Heart className="w-4 h-4 text-love-500" fill="currentColor" /> para casais
          </p>
          <p className="mt-1 text-love-300">Cada um em sua casa, mas juntos no jogo! 🏠💕</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
