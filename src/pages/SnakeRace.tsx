import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

interface Point { x: number; y: number; }
interface Snake { dir: string; body: Point[]; color: string; }

export default function SnakeRace() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playClick, playWin, playWrong } = useSounds();

  const playerName = searchParams.get('name') || 'Jogador';
  const avatar = searchParams.get('avatar') || '🐱';

  const [snakes, setSnakes] = useState<Snake[]>([]);
  const [food, setFood] = useState<Point>({ x: 10, y: 10 });
  const [scores, setScores] = useState<number[]>([0, 0]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [grid, setGrid] = useState({ w: 20, h: 20 });
  const [myIndex, setMyIndex] = useState(0);

  useEffect(() => {
    emit('snake:join', { roomId });

    const unsub1 = on('snake:start', (data: { snakes: Snake[]; food: Point; grid: { w: number; h: number }; target: number }) => {
      setSnakes(data.snakes);
      setFood(data.food);
      setGrid(data.grid);
      setGameOver(false);
      setWinner(null);
    });

    const unsub2 = on('snake:tick', (data: { snakes: Snake[]; food: Point; scores: number[] }) => {
      setSnakes(data.snakes);
      setFood(data.food);
      setScores(data.scores);
    });

    const unsub3 = on('snake:gameOver', (data: { winner: string; scores: number[] }) => {
      setGameOver(true);
      setWinner(data.winner);
      setScores(data.scores);
      if (data.winner === playerName) playWin(); else playWrong();
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [roomId, emit, on, playerName]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOver) return;
      const dirMap: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const dir = dirMap[e.key];
      if (dir) { e.preventDefault(); emit('snake:dir', { roomId, dir }); playClick(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [roomId, emit, gameOver, playClick]);

  const resetGame = () => emit('snake:reset', { roomId });

  const CELL = 20;

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(`/room/${roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}`)} className="flex items-center gap-2 text-love-600 font-bold">
            <ArrowLeft size={20} /> Trocar Jogo
          </motion.button>
          <h1 className="text-xl font-black text-love-700">🐍 Corrida de Cobras</h1>
          <div className="flex gap-2">
            {gameOver && (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={resetGame} className="p-2 rounded-full bg-love-100 text-love-600">
                <RotateCcw size={20} />
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} className="text-red-400 font-bold text-xs">🚪 Sair</motion.button>
          </div>
        </div>

        {/* Scores */}
        <div className="flex justify-between mb-3">
          {snakes.map((s, i) => (
            <div key={i} className={`px-3 py-1 rounded-full text-sm font-bold ${s.color === 'love' ? 'bg-love-100 text-love-600' : 'bg-purple-100 text-purple-600'}`}>
              {s.color === 'love' ? '💕' : '💗'} {scores[i] || 0} 🍎
            </div>
          ))}
        </div>

        {/* Game Grid */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-3 shadow-xl border-2 border-love-100 overflow-hidden">
          <svg width={grid.w * CELL} height={grid.h * CELL} viewBox={`0 0 ${grid.w * CELL} ${grid.h * CELL}`} className="w-full h-auto">
            {/* Grid background */}
            <rect width={grid.w * CELL} height={grid.h * CELL} fill="#fff1f2" rx="12" />
            {Array.from({ length: grid.w * grid.h }).map((_, i) => {
              const x = (i % grid.w) * CELL;
              const y = Math.floor(i / grid.w) * CELL;
              return <rect key={i} x={x} y={y} width={CELL} height={CELL} fill={(Math.floor(i / grid.w) + i % grid.w) % 2 === 0 ? '#fff1f2' : '#ffe4e6'} />;
            })}
            {/* Food */}
            <text x={food.x * CELL + CELL / 2} y={food.y * CELL + CELL / 2 + 6} textAnchor="middle" fontSize="16">🍎</text>
            {/* Snakes */}
            {snakes.map((s, si) => s.body.map((p, pi) => (
              <rect key={`${si}-${pi}`} x={p.x * CELL + 1} y={p.y * CELL + 1} width={CELL - 2} height={CELL - 2} rx={pi === 0 ? 6 : 3}
                fill={s.color === 'love' ? (pi === 0 ? '#f43f5e' : '#fda4af') : (pi === 0 ? '#9333ea' : '#c084fc')}
                opacity={pi === 0 ? 1 : 0.8 - pi * 0.03}
              />
            )))}
          </svg>
        </div>

        {gameOver && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 text-center">
            <div className="text-4xl mb-2">🏆</div>
            <p className="text-xl font-black text-love-700">{winner || 'Empate'} venceu!</p>
          </motion.div>
        )}

        <div className="mt-3 text-center text-love-400 text-xs">
          Use WASD ou setas para mudar de direção
        </div>
      </motion.div>
      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}
