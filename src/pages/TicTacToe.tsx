import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Trophy, ArrowRight } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useSounds } from '../hooks/useSounds';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

type Board = (string | null)[];
type Player = 'X' | 'O';

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export default function TicTacToe() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playClick, playWin, playDraw } = useSounds();
  
  const playerName = searchParams.get('name') || 'Jogador';
  const avatar = searchParams.get('avatar') || '🐱';
  
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [mySymbol, setMySymbol] = useState<Player | null>(null);
  const [currentTurn, setCurrentTurn] = useState<Player>('X');
  const [winner, setWinner] = useState<string | null>(null);
  const [winningLine, setWinningLine] = useState<number[]>([]);
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });
  const [players, setPlayers] = useState<{ X: string; O: string }>({ X: '', O: '' });
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    emit('game:join', { roomId, gameType: 'tictactoe', playerName });

    const unsub1 = on('game:assigned', (data: { symbol: Player; players: { X: string; O: string } }) => {
      setMySymbol(data.symbol);
      setPlayers(data.players);
    });
    const unsub2 = on('game:start', () => setGameStarted(true));
    const unsub3 = on('game:move', (data: { board: Board; currentTurn: Player }) => {
      setBoard(data.board);
      setCurrentTurn(data.currentTurn);
    });
    const unsub4 = on('game:win', (data: { winner: string; line: number[]; scores: any }) => {
      setWinner(data.winner);
      setWinningLine(data.line);
      setScores(data.scores);
      playWin();
    });
    const unsub5 = on('game:draw', (data: { scores: any }) => {
      setWinner('draw');
      setScores(data.scores);
      playDraw();
    });
    const unsub6 = on('game:reset', (data: { board: Board; currentTurn: Player }) => {
      setBoard(data.board);
      setCurrentTurn(data.currentTurn);
      setWinner(null);
      setWinningLine([]);
    });
    const unsub7 = on('game:playerLeft', (data: { playerName: string }) => {
      alert(`${data.playerName} saiu do jogo`);
      navigate('/');
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); };
  }, [roomId, playerName, emit, on, navigate]);

  const checkWinner = useCallback((b: Board): { winner: string | null; line: number[] } => {
    for (const combo of WINNING_COMBOS) {
      const [a, bb, c] = combo;
      if (b[a] && b[a] === b[bb] && b[a] === b[c]) return { winner: b[a], line: combo };
    }
    return { winner: null, line: [] };
  }, []);

  const handleCellClick = (index: number) => {
    if (!gameStarted || winner || board[index] || currentTurn !== mySymbol) return;
    const newBoard = [...board];
    newBoard[index] = mySymbol;
    const result = checkWinner(newBoard);
    setBoard(newBoard);
    playClick();
    emit('game:move', { roomId, board: newBoard, index, symbol: mySymbol });
    if (result.winner) emit('game:win', { roomId, winner: result.winner, line: result.line });
    else if (newBoard.every(cell => cell !== null)) emit('game:draw', { roomId });
    else setCurrentTurn(currentTurn === 'X' ? 'O' : 'X');
  };

  const resetGame = () => emit('game:reset', { roomId });

  const backToRoom = () => navigate(`/room/${roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}`);

  const getCellEmoji = (value: string | null) => {
    if (value === 'X') return '💕';
    if (value === 'O') return '💗';
    return '';
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={backToRoom} className="flex items-center gap-2 text-love-600 font-bold">
            <ArrowLeft size={20} /> Voltar
          </motion.button>
          <h1 className="text-xl font-black text-love-700">Jogo da Velha 💕</h1>
          <div className="flex gap-2">
            {winner && (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={resetGame} className="p-2 rounded-full bg-love-100 text-love-600">
                <RotateCcw size={20} />
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={backToRoom} className="p-2 rounded-full bg-love-100 text-love-600">
              <ArrowRight size={20} />
            </motion.button>
          </div>
        </div>

        {/* Players */}
        <div className="flex justify-between items-center mb-6">
          <div className={`text-center p-3 rounded-2xl flex-1 mr-2 ${mySymbol === 'X' ? 'bg-love-100 border-2 border-love-400' : 'bg-white/50 border-2 border-transparent'}`}>
            <span className="text-2xl">💕</span>
            <p className="font-bold text-love-700 text-sm truncate">{players.X || 'Esperando...'}</p>
            <p className="text-love-500 text-xs">{scores.X} vitorias</p>
          </div>
          <div className="text-love-400 font-bold text-sm">VS</div>
          <div className={`text-center p-3 rounded-2xl flex-1 ml-2 ${mySymbol === 'O' ? 'bg-love-100 border-2 border-love-400' : 'bg-white/50 border-2 border-transparent'}`}>
            <span className="text-2xl">💗</span>
            <p className="font-bold text-love-700 text-sm truncate">{players.O || 'Esperando...'}</p>
            <p className="text-love-500 text-xs">{scores.O} vitorias</p>
          </div>
        </div>

        {/* Turn indicator */}
        <div className="text-center mb-4">
          {gameStarted ? (
            winner ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center justify-center gap-2 text-lg font-bold">
                {winner === 'draw' ? (
                  <span className="text-love-500">Empate! 🤝</span>
                ) : (
                  <span className="text-love-600">
                    <Trophy className="inline w-5 h-5 mr-1" />
                    {winner === mySymbol ? 'Voce ganhou! 🎉' : `${players[winner as Player]} ganhou! 💕`}
                  </span>
                )}
              </motion.div>
            ) : (
              <p className={`font-bold ${currentTurn === mySymbol ? 'text-love-600 animate-pulse' : 'text-love-400'}`}>
                {currentTurn === mySymbol ? '✨ Sua vez!' : `Aguardando ${players[currentTurn]}...`}
              </p>
            )
          ) : (
            <p className="text-love-400 font-bold">Esperando o outro jogador... ⏳</p>
          )}
        </div>

        {/* Game board */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 shadow-xl shadow-love-200/30 border-2 border-love-100 mb-6">
          <div className="grid grid-cols-3 gap-2">
            {board.map((cell, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: cell || winner || currentTurn !== mySymbol ? 1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCellClick(index)}
                disabled={!!cell || !!winner || currentTurn !== mySymbol || !gameStarted}
                className={`aspect-square rounded-2xl flex items-center justify-center text-3xl font-bold transition-all duration-200
                           ${winningLine.includes(index) ? 'bg-gradient-to-br from-love-400 to-love-600 shadow-lg shadow-love-300/50'
                             : cell ? 'bg-love-50 border-2 border-love-200'
                             : 'bg-gray-50 border-2 border-gray-200 hover:border-love-300 hover:bg-love-50 cursor-pointer'}`}
              >
                {cell && (
                  <motion.span initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
                    {getCellEmoji(cell)}
                  </motion.span>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="text-center">
          <p className="text-love-400 text-sm font-bold">Empates: {scores.draws} 🤝</p>
        </div>
      </motion.div>

      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}
