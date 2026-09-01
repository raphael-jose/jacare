import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

interface Obstacle { x: number; y: number; type: string; life: number; }
interface RunnerPlayer { y: number; alive: boolean; score: number; jumping: boolean; slide: boolean; }

export default function Runner() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playClick, playWin, playWrong } = useSounds();

  const playerName = searchParams.get('name') || 'Jogador';
  const avatar = searchParams.get('avatar') || '🐱';

  const [players, setPlayers] = useState<RunnerPlayer[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [myIndex, setMyIndex] = useState(0);

  useEffect(() => {
    emit('runner:join', { roomId });

    const unsub1 = on('runner:start', (data: { players: RunnerPlayer[]; grid: any }) => {
      setPlayers(data.players);
      setGameOver(false);
      setWinner(null);
    });

    const unsub2 = on('runner:tick', (data: { players: RunnerPlayer[]; obstacles: Obstacle[]; tick: number }) => {
      setPlayers(data.players);
      setObstacles(data.obstacles);
    });

    const unsub3 = on('runner:gameOver', (data: { players: RunnerPlayer[]; winner: string }) => {
      setPlayers(data.players);
      setGameOver(true);
      setWinner(data.winner);
      if (data.winner === playerName) playWin(); else playWrong();
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [roomId, emit, on, playerName]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); emit('runner:action', { roomId, action: 'jump' }); playClick(); }
      if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); emit('runner:action', { roomId, action: 'slide' }); playClick(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [roomId, emit, gameOver, playClick]);

  // Touch controls
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (gameOver) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (dy < -30) { emit('runner:action', { roomId, action: 'jump' }); playClick(); }
    else if (dy > 30) { emit('runner:action', { roomId, action: 'slide' }); playClick(); }
  };

  const resetGame = () => emit('runner:reset', { roomId });

  const LANES = 7;
  const LANE_H = 40;

  return (
    <div className="min-h-screen flex flex-col items-center p-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(`/room/${roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}`)} className="flex items-center gap-2 text-love-600 font-bold">
            <ArrowLeft size={20} /> Trocar Jogo
          </motion.button>
          <h1 className="text-xl font-black text-love-700">🏃 Runner</h1>
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
          {players.map((p, i) => (
            <div key={i} className={`px-3 py-1 rounded-full text-sm font-bold ${p.alive ? (i === 0 ? 'bg-love-100 text-love-600' : 'bg-purple-100 text-purple-600') : 'bg-gray-200 text-gray-400'}`}>
              {i === 0 ? '💕' : '💗'} {p.alive ? `🏃 ${p.score}` : '💀 Eliminado'}
            </div>
          ))}
        </div>

        {/* Track */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-3 shadow-xl border-2 border-love-100 overflow-hidden">
          <svg width="400" height={LANES * LANE_H} viewBox={`0 0 400 ${LANES * LANE_H}`} className="w-full h-auto">
            <rect width="400" height={LANES * LANE_H} fill="#fff1f2" rx="12" />
            {/* Lanes */}
            {Array.from({ length: LANES }).map((_, i) => (
              <line key={i} x1="0" y1={i * LANE_H} x2="400" y2={i * LANE_H} stroke="#fecdd3" strokeWidth="1" strokeDasharray="5,5" />
            ))}
            {/* Obstacles */}
            {obstacles.map((o, i) => (
              <g key={i}>
                {o.type === 'low' ? (
                  <rect x={o.x * 400 / 15} y={o.y * LANE_H + 10} width="30" height="20" rx="4" fill="#f43f5e" opacity="0.8" />
                ) : (
                  <circle cx={o.x * 400 / 15 + 15} cy={o.y * LANE_H + 5} r="12" fill="#f43f5e" opacity="0.8" />
                )}
              </g>
            ))}
            {/* Players */}
            {players.map((p, i) => (
              <g key={i}>
                <rect x={30} y={p.y * LANE_H + 5} width="30" height="30" rx="8"
                  fill={i === 0 ? '#f43f5e' : '#9333ea'} opacity={p.alive ? 1 : 0.3} />
                <text x={45} y={p.y * LANE_H + 25} textAnchor="middle" fontSize="18">
                  {p.alive ? (i === 0 ? '💕' : '💗') : '💀'}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {gameOver && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 text-center">
            <div className="text-4xl mb-2">🏆</div>
            <p className="text-xl font-black text-love-700">{winner || 'Empate'} venceu!</p>
          </motion.div>
        )}

        <div className="mt-3 text-center text-love-400 text-xs">
          ↑ Pular obstáculos altos | ↓ Deslizar por baixo
        </div>
      </motion.div>
      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}
