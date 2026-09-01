import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Check, Heart, Users, Gamepad2, Sparkles } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

const GAMES = [
  { id: 'tictactoe', name: 'Jogo da Velha', emoji: '❌⭕', description: 'O classico jogo da velha, mas mais fofo!', color: 'from-rose-400 to-pink-500', bg: 'bg-rose-50', border: 'border-rose-200' },
  { id: 'hangman', name: 'Jogo da Forca', emoji: '🎯', description: 'Adivinhe a palavra do amor!', color: 'from-fuchsia-400 to-purple-500', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
  { id: 'memory', name: 'Jogo da Memoria', emoji: '🧠', description: 'Teste sua memoria com cartas fofas!', color: 'from-amber-400 to-orange-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'words', name: 'Jogo de Palavras', emoji: '✍️', description: 'Quem escreve mais rapido?', color: 'from-cyan-400 to-blue-500', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  { id: 'snake', name: 'Corrida de Cobras', emoji: '🐍', description: 'Compete por comida! Quem crescer mais vence!', color: 'from-green-400 to-emerald-500', bg: 'bg-green-50', border: 'border-green-200' },
  { id: 'runner', name: 'Runner Competitivo', emoji: '🏃', description: 'Corra e desvie de obstaculos lado a lado!', color: 'from-orange-400 to-red-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  { id: 'dodgeball', name: 'Dodgeball', emoji: '🤾', description: 'Jogue bolas uma na outra! Quem acertar mais vence!', color: 'from-violet-400 to-purple-500', bg: 'bg-violet-50', border: 'border-violet-200' },
  { id: 'kitchen', name: 'Cozinha Caotica', emoji: '🍳', description: 'Cozinhe juntos contra o tempo! Tipo Overcooked!', color: 'from-yellow-400 to-amber-500', bg: 'bg-yellow-50', border: 'border-yellow-200' },
];

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emit, on } = useSocket();

  const playerName = searchParams.get('name') || 'Jogador';
  const avatar = searchParams.get('avatar') || '🐱';
  const isCreator = searchParams.get('creator') === '1';
  const [players, setPlayers] = useState<{ name: string; avatar: string }[]>(isCreator ? [{ name: playerName, avatar }] : []);
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  useEffect(() => {
    // Creator already joined via room:create, only joiners need to emit room:join
    // Request current room state (works for both creator and joiner)
    emit('room:getState', { roomId });

    if (!isCreator) {
      emit('room:join', { roomId, playerName, avatar });
    }

    const unsub0 = on('room:state', (data: { players: { name: string; avatar: string }[]; gameType: string | null }) => {
      setPlayers(data.players);
      if (data.players.length >= 2) setWaiting(false);
      // If game already selected, navigate to it
      if (data.gameType) {
        navigate(`/game/${data.gameType}/${roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}`);
      }
    });

    const unsub1 = on('room:joined', (data: { roomId: string; players: { name: string; avatar: string }[] }) => {
      setPlayers(data.players);
      if (data.players.length >= 2) setWaiting(false);
    });

    const unsub2 = on('room:playerJoined', (data: { players: { name: string; avatar: string }[]; playerName: string }) => {
      setPlayers(data.players);
      setWaiting(false);
    });

    const unsub3 = on('room:error', (data: { message: string }) => {
      alert(data.message);
      navigate('/');
    });

    const unsub4 = on('room:gameSelected', (data: { gameType: string }) => {
      navigate(`/game/${data.gameType}/${roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}`);
    });

    return () => { unsub0(); unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [roomId, playerName, emit, on, navigate]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(roomId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareRoom = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/?join=${roomId}`;
    const shareData = {
      title: 'Vem jogar comigo! 💕',
      text: `Entra na sala e coloca seu nome!\n\nCódigo: ${roomId}\n\nOu clique no link:`,
      url: shareUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      copyCode();
    }
  };

  const selectGame = (gameId: string) => {
    setSelectedGame(gameId);
    emit('room:selectGame', { roomId, gameType: gameId });
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Back + Leave buttons */}
        <div className="flex items-center justify-between mb-6">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-red-400 font-bold text-sm"
          >
            🚪 Sair da Sala
          </motion.button>
        </div>

        {/* Room header */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="text-center mb-6"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-5xl mb-3"
          >
            {waiting ? '⏳' : '💕'}
          </motion.div>
          <h1 className="text-3xl font-black text-love-700 mb-1">Sala de Jogos</h1>
          <p className="text-love-500 font-medium">
            {waiting ? 'Esperando seu parceiro...' : 'Escolham um jogo para jogar!'}
          </p>
        </motion.div>

        {/* Room code card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-xl shadow-love-200/30 border-2 border-love-100 mb-4">
          <p className="text-sm text-love-500 font-bold mb-2 text-center">Codigo da sala:</p>
          <div className="bg-gradient-to-r from-love-50 to-love-100 rounded-2xl p-4 mb-4 border-2 border-love-200 text-center">
            <span className="text-4xl font-black text-love-600 tracking-[0.3em]">{roomId}</span>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={copyCode}
              className="flex-1 btn-outline flex items-center justify-center gap-2 text-sm py-2"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar Codigo'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={shareRoom}
              className="flex-1 btn-love flex items-center justify-center gap-2 text-sm py-2"
            >
              📤 Compartilhar Link
            </motion.button>
          </div>
        </div>

        {/* Players connected */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 shadow-xl shadow-love-200/30 border-2 border-love-100 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-love-500" />
              <span className="font-bold text-love-700 text-sm">Jogadores na sala</span>
            </div>
            <span className="text-love-500 text-sm font-bold">{players.length}/2</span>
          </div>
          <div className="mt-3 space-y-2">
            {players.map((player, i) => (
              <motion.div
                key={player.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 bg-love-50 rounded-xl px-4 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-love-400 to-love-600 flex items-center justify-center text-lg">
                  {player.avatar}
                </div>
                <span className="font-bold text-love-700">{player.name}</span>
                {i === 0 && <span className="text-xs text-love-400">(criador)</span>}
              </motion.div>
            ))}
            {players.length < 2 && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2 border-2 border-dashed border-gray-200">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                  ?
                </div>
                <span className="text-gray-400 font-medium text-sm">Esperando jogador...</span>
              </div>
            )}
          </div>
        </div>

        {/* Game selector */}
        <AnimatePresence>
          {!waiting && players.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-love-500" />
                <span className="font-bold text-love-700">Escolham um jogo!</span>
              </div>
              <div className="space-y-3">
                {GAMES.map((game, i) => (
                  <motion.button
                    key={game.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectGame(game.id)}
                    disabled={selectedGame !== null}
                    className={`w-full ${game.bg} border-2 ${game.border} rounded-3xl p-4 flex items-center gap-4 
                               transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="text-3xl">{game.emoji}</span>
                    <div className="text-left flex-1">
                      <h3 className="text-lg font-black text-gray-800">{game.name}</h3>
                      <p className="text-gray-500 text-xs font-medium">{game.description}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${game.color} flex items-center justify-center shadow-md`}>
                      <Gamepad2 className="w-5 h-5 text-white" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Music banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gradient-to-r from-love-400 to-love-600 rounded-3xl p-4 mb-4 text-white text-center cursor-pointer"
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-music'))}
        >
          <p className="font-bold text-sm">🎵 Gustavo Mioto - Românticas</p>
          <p className="text-xs text-love-100">Clique pra tocar enquanto jogam! 💕</p>
        </motion.div>

        {/* Waiting animation */}
        {waiting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-6"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-4xl mb-3"
            >
              💕
            </motion.div>
            <p className="text-love-500 font-bold text-sm">
              Envie o link ou codigo para seu parceiro!
            </p>
            <p className="text-love-400 text-xs mt-1">
              Assim que ele entrar, voces podem escolher o jogo
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Chat */}
      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}
