import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

interface DPlayer { x: number; y: number; hp: number; alive: boolean; dir: string; }
interface Ball { x: number; y: number; vx: number; vy: number; owner: number; life: number; }

export default function Dodgeball() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playClick, playWin, playWrong } = useSounds();

  const playerName = searchParams.get('name') || 'Jogador';
  const avatar = searchParams.get('avatar') || '🐱';

  const [players, setPlayers] = useState<DPlayer[]>([]);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    emit('dodgeball:join', { roomId });

    const unsub1 = on('dodgeball:start', (data: { players: DPlayer[]; balls: Ball[]; arena: any }) => {
      setPlayers(data.players);
      setBalls(data.balls);
      setGameOver(false);
      setWinner(null);
    });

    const unsub2 = on('dodgeball:tick', (data: { players: DPlayer[]; balls: Ball[] }) => {
      setPlayers(data.players);
      setBalls(data.balls);
    });

    const unsub3 = on('dodgeball:gameOver', (data: { players: DPlayer[]; winner: string }) => {
      setPlayers(data.players);
      setGameOver(true);
      setWinner(data.winner);
      if (data.winner === playerName) playWin(); else playWrong();
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [roomId, emit, on, playerName]);

  // Movement loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameOver) return;
      let dx = 0, dy = 0;
      if (keysPressed.current.has('ArrowUp') || keysPressed.current.has('w')) dy = -1;
      if (keysPressed.current.has('ArrowDown') || keysPressed.current.has('s')) dy = 1;
      if (keysPressed.current.has('ArrowLeft') || keysPressed.current.has('a')) dx = -1;
      if (keysPressed.current.has('ArrowRight') || keysPressed.current.has('d')) dx = 1;
      if (dx !== 0 || dy !== 0) emit('dodgeball:move', { roomId, dx, dy });
    }, 50);
    return () => clearInterval(interval);
  }, [roomId, emit, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      keysPressed.current.add(e.key);
      if (e.key === ' ') { e.preventDefault(); emit('dodgeball:throw', { roomId }); playClick(); }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current.delete(e.key); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [roomId, emit, gameOver, playClick]);

  // Touch controls
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current || gameOver) return;
    const dx = e.touches[0].clientX - touchRef.current.x;
    const dy = e.touches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      emit('dodgeball:move', { roomId, dx: Math.sign(dx), dy: Math.sign(dy) });
      touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchEnd = () => { touchRef.current = null; };

  const resetGame = () => emit('dodgeball:reset', { roomId });

  return (
    <div className="min-h-screen flex flex-col items-center p-4" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(`/room/${roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}`)} className="flex items-center gap-2 text-love-600 font-bold">
            <ArrowLeft size={20} /> Trocar Jogo
          </motion.button>
          <h1 className="text-xl font-black text-love-700">🎯 Dodgeball</h1>
          <div className="flex gap-2">
            {gameOver && (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={resetGame} className="p-2 rounded-full bg-love-100 text-love-600">
                <RotateCcw size={20} />
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} className="text-red-400 font-bold text-xs">🚪 Sair</motion.button>
          </div>
        </div>

        {/* HP */}
        <div className="flex justify-between mb-3">
          {players.map((p, i) => (
            <div key={i} className={`px-3 py-1 rounded-full text-sm font-bold ${p.alive ? (i === 0 ? 'bg-love-100 text-love-600' : 'bg-purple-100 text-purple-600') : 'bg-gray-200 text-gray-400'}`}>
              {i === 0 ? '💕' : '💗'} {p.alive ? '❤️'.repeat(p.hp) : '💀'}
            </div>
          ))}
        </div>

        {/* Arena */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-3 shadow-xl border-2 border-love-100 overflow-hidden">
          <svg width="400" height="300" viewBox="0 0 400 300" className="w-full h-auto">
            <rect width="400" height="300" fill="#fff1f2" rx="12" />
            {/* Center line */}
            <line x1="200" y1="0" x2="200" y2="300" stroke="#fecdd3" strokeWidth="2" strokeDasharray="8,4" />
            {/* Players */}
            {players.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="18" fill={i === 0 ? '#f43f5e' : '#9333ea'} opacity={p.alive ? 1 : 0.3} />
                <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="16">{p.alive ? (i === 0 ? '💕' : '💗') : '💀'}</text>
              </g>
            ))}
            {/* Balls */}
            {balls.map((b, i) => (
              <circle key={i} cx={b.x} cy={b.y} r="6" fill="#fb923c" opacity="0.9" />
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
          WASD/Setas = Mover | Espaço = Jogar bola
        </div>
      </motion.div>
      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}
