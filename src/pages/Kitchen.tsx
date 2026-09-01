import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

interface Order { name: string; emoji: string; steps: string[]; timeLeft: number; }
interface KitchenPlayer { x: number; y: number; carrying: string | null; }
interface Station { id: string; x: number; y: number; type: string; items?: string[]; accepts?: string[]; }

export default function Kitchen() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playClick, playWin, playWrong } = useSounds();

  const playerName = searchParams.get('name') || 'Jogador';
  const avatar = searchParams.get('avatar') || '🐱';

  const [orders, setOrders] = useState<Order[]>([]);
  const [players, setPlayers] = useState<KitchenPlayer[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [gameOver, setGameOver] = useState(false);
  const [stations] = useState<Station[]>([
    { id: 'fridge', x: 50, y: 50, type: 'fridge', items: ['massa', 'arroz', 'pao'] },
    { id: 'board', x: 150, y: 50, type: 'board' },
    { id: 'stove', x: 250, y: 50, type: 'stove' },
    { id: 'plate', x: 350, y: 50, type: 'plate' },
    { id: 'trash', x: 350, y: 250, type: 'trash' },
  ]);
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    emit('kitchen:join', { roomId });

    const unsub1 = on('kitchen:start', (data: any) => {
      setOrders(data.orders);
      setPlayers(data.players);
      setScore(data.score);
      setTimeLeft(data.timeLeft);
      setGameOver(false);
    });

    const unsub2 = on('kitchen:state', (data: any) => {
      setOrders(data.orders);
      setPlayers(data.players);
      setScore(data.score);
      setTimeLeft(data.timeLeft);
    });

    const unsub3 = on('kitchen:gameOver', (data: { score: number }) => {
      setGameOver(true);
      setScore(data.score);
      playWin();
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [roomId, emit, on]);

  // Movement
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameOver) return;
      let dx = 0, dy = 0;
      if (keysPressed.current.has('ArrowUp') || keysPressed.current.has('w')) dy = -1;
      if (keysPressed.current.has('ArrowDown') || keysPressed.current.has('s')) dy = 1;
      if (keysPressed.current.has('ArrowLeft') || keysPressed.current.has('a')) dx = -1;
      if (keysPressed.current.has('ArrowRight') || keysPressed.current.has('d')) dx = 1;
      if (dx !== 0 || dy !== 0) emit('kitchen:move', { roomId, dx, dy });
    }, 50);
    return () => clearInterval(interval);
  }, [roomId, emit, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (e.key === ' ' || e.key === 'e') { e.preventDefault(); emit('kitchen:interact', { roomId }); playClick(); }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current.delete(e.key); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [roomId, emit, playClick]);

  const resetGame = () => emit('kitchen:reset', { roomId });

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(`/room/${roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}`)} className="flex items-center gap-2 text-love-600 font-bold">
            <ArrowLeft size={20} /> Trocar Jogo
          </motion.button>
          <h1 className="text-xl font-black text-love-700">🍳 Cozinha Caótica</h1>
          <div className="flex gap-2">
            {gameOver && (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={resetGame} className="p-2 rounded-full bg-love-100 text-love-600">
                <RotateCcw size={20} />
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} className="text-red-400 font-bold text-xs">🚪 Sair</motion.button>
          </div>
        </div>

        {/* Score & Timer */}
        <div className="flex justify-between items-center mb-3">
          <div className="px-3 py-1 rounded-full bg-love-100 text-love-600 text-sm font-bold">⭐ {score} pts</div>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${timeLeft < 15 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
            ⏱️ {timeLeft}s
          </div>
        </div>

        {/* Orders */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-3 shadow-xl border-2 border-love-100 mb-3">
          <p className="text-xs font-bold text-love-500 mb-2">📋 Pedidos:</p>
          <div className="flex gap-2 flex-wrap">
            <AnimatePresence>
              {orders.map((o, i) => (
                <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  className={`px-3 py-2 rounded-xl text-sm font-bold border-2 ${o.timeLeft < 10 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  <span className="text-lg">{o.emoji}</span> {o.name}
                  <div className="text-xs text-gray-400 mt-1">⏱️ {o.timeLeft}s</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Kitchen */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-3 shadow-xl border-2 border-love-100 overflow-hidden">
          <svg width="400" height="300" viewBox="0 0 400 300" className="w-full h-auto">
            <rect width="400" height="300" fill="#fff1f2" rx="12" />
            {/* Stations */}
            {stations.map(s => (
              <g key={s.id}>
                <rect x={s.x - 25} y={s.y - 25} width="50" height="50" rx="8" fill={
                  s.type === 'fridge' ? '#dbeafe' : s.type === 'stove' ? '#fee2e2' : s.type === 'plate' ? '#fef3c7' : s.type === 'trash' ? '#e5e7eb' : '#f0fdf4'
                } stroke={
                  s.type === 'fridge' ? '#93c5fd' : s.type === 'stove' ? '#fca5a5' : s.type === 'plate' ? '#fcd34d' : s.type === 'trash' ? '#9ca3af' : '#86efac'
                } strokeWidth="2" />
                <text x={s.x} y={s.y + 6} textAnchor="middle" fontSize="20">
                  {s.type === 'fridge' ? '🧊' : s.type === 'stove' ? '🔥' : s.type === 'plate' ? '🍽️' : s.type === 'trash' ? '🗑️' : '🔪'}
                </text>
                <text x={s.x} y={s.y + 40} textAnchor="middle" fontSize="8" fill="#9ca3af">
                  {s.type === 'fridge' ? 'Geladeira' : s.type === 'stove' ? 'Fogão' : s.type === 'plate' ? 'Prato' : s.type === 'trash' ? 'Lixo' : 'Tábua'}
                </text>
              </g>
            ))}
            {/* Players */}
            {players.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="18" fill={i === 0 ? '#f43f5e' : '#9333ea'} opacity="0.9" />
                <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="14">{i === 0 ? '💕' : '💗'}</text>
                {p.carrying && (
                  <text x={p.x} y={p.y - 22} textAnchor="middle" fontSize="14">📋</text>
                )}
              </g>
            ))}
          </svg>
        </div>

        {gameOver && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-xl font-black text-love-700">Fim de jogo!</p>
            <p className="text-lg text-love-500">Score: {score} ⭐</p>
          </motion.div>
        )}

        <div className="mt-3 text-center text-love-400 text-xs">
          WASD = Mover | Espaço/E = Interagir
        </div>
      </motion.div>
      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}
