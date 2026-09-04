import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Heart, Check, X, Timer, Search, Crown } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';
import { showError } from '../utils/alert';
import { getPlayerInfo } from '../utils/player';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

interface WordInfo {
  text: string;
  cells: number[];
  found: boolean;
}

export default function WordGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playClick, playCorrect, playWrong, playWin } = useSounds();

  const { name: playerName } = getPlayerInfo();

  const [grid, setGrid] = useState<string[]>([]);
  const [words, setWords] = useState<WordInfo[]>([]);
  const [scores, setScores] = useState<{ player1: number; player2: number }>({ player1: 0, player2: 0 });
  const [currentTurn, setCurrentTurn] = useState(0);
  const [myIndex, setMyIndex] = useState(0);
  const [players, setPlayers] = useState<string[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [foundCells, setFoundCells] = useState<Set<number>>(new Set());
  const [missedWord, setMissedWord] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const myTurn = currentTurn === myIndex;

  // Timer — only counts when it's my turn
  useEffect(() => {
    if (!myTurn || gameOver) return;
    setTimeLeft(30);
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          emit('wordsearch:pass', { roomId });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [myTurn, gameOver, roomId, emit]);

  useEffect(() => {
    emit('game:join', { roomId, gameType: 'words', playerName });

    const unsub1 = on('game:assigned', (data: { playerIndex: number; players: string[] }) => {
      setMyIndex(data.playerIndex);
      setPlayers(data.players);
    });

    const unsub2 = on('wordsearch:start', (data: { grid: string[]; words: WordInfo[]; scores: { player1: number; player2: number }; currentTurn: number }) => {
      setGrid(data.grid);
      setWords(data.words);
      setScores(data.scores);
      setCurrentTurn(data.currentTurn);
      setSelection([]);
      setFoundCells(new Set());
      setMissedWord(null);
      setGameOver(null);
    });

    const unsub3 = on('wordsearch:turn', (data: { currentTurn: number }) => {
      setCurrentTurn(data.currentTurn);
      setSelection([]);
      setMissedWord(null);
    });

    const unsub4 = on('wordsearch:found', (data: { word: string; cells: number[]; wordsFound: string[]; scores: { player1: number; player2: number }; currentTurn: number }) => {
      playCorrect();
      setWords(prev => prev.map(w => w.text === data.word ? { ...w, found: true } : w));
      setFoundCells(prev => new Set([...prev, ...data.cells]));
      setScores(data.scores);
      setCurrentTurn(data.currentTurn);
      setSelection([]);
      setMissedWord(null);
    });

    const unsub5 = on('wordsearch:miss', (data: { word: string; currentTurn: number }) => {
      playWrong();
      setMissedWord(data.word);
      setCurrentTurn(data.currentTurn);
      setSelection([]);
    });

    const unsub6 = on('wordsearch:gameOver', (data: { scores: { player1: number; player2: number }; winner: string | null }) => {
      setScores(data.scores);
      setGameOver(data.winner);
      playWin();
    });

    const unsub7 = on('game:playerLeft', (data: { playerName: string }) => {
      showError(`${data.playerName} saiu do jogo 😢`).then(() => navigate(`/room/${roomId}`));
    });

    const unsub8 = on('room:backToRoom', () => {
      navigate(`/room/${roomId}`);
    });

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8();
    };
  }, [roomId, playerName, emit, on, navigate]);

  const handleCellClick = (index: number) => {
    if (!myTurn || gameOver) return;
    if (foundCells.has(index)) return; // already found — not selectable
    playClick();

    setSelection(prev => {
      // Toggle if last selected
      if (prev[prev.length - 1] === index) return prev.slice(0, -1);
      if (prev.includes(index)) return prev;
      if (prev.length >= 8) return prev;
      return [...prev, index];
    });
  };

  const submitSelection = () => {
    if (selection.length < 3 || !myTurn || gameOver) return;
    const word = selection.map(i => grid[i]).join('');
    emit('wordsearch:guess', { roomId, word });
  };

  const clearSelection = () => {
    setSelection([]);
    setMissedWord(null);
  };

  const resetGame = () => {
    emit('wordsearch:reset', { roomId });
  };

  const goBack = () => {
    emit('room:backToRoom', { roomId });
    navigate(`/room/${roomId}`);
  };

  const selectedWord = selection.map(i => grid[i]).join('');

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={goBack}
            className="flex items-center gap-2 text-love-600 font-bold"
          >
            <ArrowLeft size={20} />
            Trocar Jogo
          </motion.button>
          <h1 className="pixel-font text-lg font-black text-love-700 flex items-center gap-2">
            <Search size={20} className="text-love-500" />
            CAÇA-PALAVRAS
          </h1>
          <div className="flex gap-2">
            {gameOver && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={resetGame}
                className="p-2 rounded-full bg-love-100 text-love-600"
              >
                <RotateCcw size={20} />
              </motion.button>
            )}
          </div>
        </div>

        {/* Players & turn */}
        <div className="flex justify-between items-center mb-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${myTurn ? 'bg-love-500 text-white' : 'bg-white/80 text-love-600'}`}>
            <span className="font-bold text-sm">{players[myIndex] || 'Você'}</span>
            <span className="text-xs opacity-80">{scores.player1} pts</span>
          </div>
          <div className="flex items-center gap-2 text-love-400">
            {myTurn ? (
              <span className="font-bold text-sm flex items-center gap-1">
                <Timer size={14} className={timeLeft <= 5 ? 'text-red-500 animate-pulse' : ''} />
                Sua vez! {timeLeft}s
              </span>
            ) : (
              <span className="font-bold text-sm">Vez de {players[1 - myIndex] || 'oponente'}...</span>
            )}
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${!myTurn && !gameOver ? 'bg-love-500 text-white' : 'bg-white/80 text-love-600'}`}>
            <span className="text-xs opacity-80">{scores.player2} pts</span>
            <span className="font-bold text-sm">{players[1 - myIndex] || 'Oponente'}</span>
          </div>
        </div>

        {/* Words to find */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 shadow-lg border-2 border-love-100 mb-4">
          <p className="text-sm text-love-500 font-bold mb-2 text-center">Encontre estas palavras:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {words.map((w) => (
              <span
                key={w.text}
                className={`px-3 py-1 rounded-full text-sm font-black border-2 ${
                  w.found
                    ? 'bg-green-50 border-green-300 text-green-600 line-through'
                    : 'bg-love-50 border-love-200 text-love-700'
                }`}
              >
                {w.text}
              </span>
            ))}
          </div>
        </div>

        {/* Grid */}
        {grid.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-3 shadow-xl shadow-love-200/30 border-2 border-love-100 mb-4">
            <div className="grid grid-cols-10 gap-1">
              {grid.map((letter, i) => {
                const isSelected = selection.includes(i);
                const isFound = foundCells.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => handleCellClick(i)}
                    disabled={!myTurn || !!gameOver || isFound}
                    className={`aspect-square flex items-center justify-center rounded-md font-black text-sm sm:text-base transition-all ${
                      isFound
                        ? 'bg-green-100 text-green-600 border-2 border-green-300'
                        : isSelected
                          ? 'bg-love-500 text-white border-2 border-love-600 scale-110'
                          : 'bg-love-50 text-love-700 border-2 border-love-100 hover:bg-love-100'
                    } ${!myTurn ? 'opacity-70' : ''}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selection bar */}
        {myTurn && !gameOver && (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-4 shadow-lg border-2 border-love-100 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 text-center">
                <span className="text-2xl font-black tracking-widest text-love-700">
                  {selectedWord || '—'}
                </span>
                {missedWord && (
                  <motion.p
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-xs text-red-500 font-bold mt-1 flex items-center justify-center gap-1"
                  >
                    <X size={12} /> "{missedWord}" não está na lista!
                  </motion.p>
                )}
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={clearSelection}
                  disabled={selection.length === 0}
                  className="px-3 py-2 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm disabled:opacity-40"
                >
                  Limpar
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={submitSelection}
                  disabled={selection.length < 3}
                  className="px-4 py-2 rounded-xl btn-love flex items-center gap-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check size={16} />
                  Confirmar
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {/* Not your turn */}
        {!myTurn && !gameOver && (
          <div className="text-center text-love-400 text-sm font-bold mb-4">
            <Heart size={16} className="inline mr-1" />
            Espere sua vez para selecionar as letras
          </div>
        )}

        {/* Game over */}
        <AnimatePresence>
          {gameOver !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-love-200/30 border-2 border-love-100 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-6xl mb-4 flex items-center justify-center"
              >
                <Crown className="text-amber-400" size={64} />
              </motion.div>
              <h2 className="text-2xl font-black text-love-700 mb-4">Todas as palavras encontradas!</h2>

              <div className="flex justify-center gap-8 mb-6">
                <div className="text-center">
                  <p className="text-love-500 text-sm font-bold">{players[0]}</p>
                  <p className="text-3xl font-black text-love-600">{scores.player1}</p>
                  <p className="text-love-400 text-xs">pontos</p>
                </div>
                <div className="text-center">
                  <p className="text-love-500 text-sm font-bold">{players[1]}</p>
                  <p className="text-3xl font-black text-love-600">{scores.player2}</p>
                  <p className="text-love-400 text-xs">pontos</p>
                </div>
              </div>

              <p className="text-lg font-bold text-love-600 mb-4">
                {gameOver ? `🎉 ${gameOver} venceu!` : '🤝 Empate!'}
              </p>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={resetGame}
                className="btn-love"
              >
                <RotateCcw className="inline w-5 h-5 mr-2" />
                Jogar Novamente
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}