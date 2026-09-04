import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Delete, Keyboard, Crown, Check, Loader2 } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';
import { showError } from '../utils/alert';
import { getPlayerInfo } from '../utils/player';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

const ROWS = 6;
const COLS = 5;

const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

const KEY_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','DEL'],
];

type CellStatus = 'correct' | 'present' | 'absent' | 'empty';

export default function TermoGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playClick, playCorrect, playWrong, playWin } = useSounds();

  const { name: playerName } = getPlayerInfo();

  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<{ player1: number; player2: number }>({ player1: 0, player2: 0 });
  const [players, setPlayers] = useState<string[]>([]);
  const [myIndex, setMyIndex] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<CellStatus[][]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [solved, setSolved] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [roundResult, setRoundResult] = useState<{ word: string; winnerName: string | null; round: number } | null>(null);
  const [finalWinner, setFinalWinner] = useState<string | null>(null);

  const attempt = guesses.length;
  const myTurn = currentTurn === myIndex;
  const canType = myTurn && !solved && !roundResult && !gameOver;
  const turnName = players[currentTurn] || (myTurn ? 'Você' : 'Parceiro(a)');

  useEffect(() => {
    emit('game:join', { roomId, gameType: 'termo', playerName });

    const unsub1 = on('game:assigned', (data: { playerIndex: number; players: string[] }) => {
      setMyIndex(data.playerIndex);
      setPlayers(data.players);
    });

    const unsub2 = on('termo:roundStart', (data: { round: number; scores: { player1: number; player2: number }; currentTurn: number }) => {
      setRound(data.round);
      setScores(data.scores);
      setCurrentTurn(data.currentTurn);
      setGuesses([]);
      setStatuses([]);
      setCurrentGuess('');
      setSolved(false);
      setRoundResult(null);
      setGameOver(false);
    });

    const unsubTurn = on('termo:turn', (data: { currentTurn: number }) => {
      setCurrentTurn(data.currentTurn);
    });

    const unsubRejoin = on('termo:rejoin', (data: {
      round: number;
      scores: { player1: number; player2: number };
      currentTurn: number;
      phase: 'round' | 'result' | 'over';
      word?: string;
      winnerName?: string | null;
      finalWinner?: string | null;
      myGuesses: string[];
      myStatuses: CellStatus[][];
      mySolved: boolean;
      myDone: boolean;
    }) => {
      setRound(data.round);
      setScores(data.scores);
      setCurrentTurn(data.currentTurn);
      setGuesses(data.myGuesses || []);
      setStatuses(data.myStatuses || []);
      setCurrentGuess('');
      setSolved(data.mySolved || false);
      if (data.phase === 'over') {
        setGameOver(true);
        setFinalWinner(data.finalWinner || null);
        setRoundResult(null);
      } else if (data.phase === 'result') {
        setRoundResult({ word: data.word || '', winnerName: data.winnerName ?? null, round: data.round });
        setGameOver(false);
      } else {
        setGameOver(false);
        setRoundResult(null);
      }
    });

    const unsub3 = on('termo:guessResult', (data: { guess: string; statuses: CellStatus[]; solved: boolean; attemptNumber: number }) => {
      setGuesses(prev => {
        if (prev.includes(data.guess)) return prev;
        return [...prev, data.guess];
      });
      setStatuses(prev => {
        if (prev.some((s, i) => i === data.attemptNumber - 1 && s.length === 5)) {
          // replace the attempt row
          const copy = [...prev];
          copy[data.attemptNumber - 1] = data.statuses;
          return copy;
        }
        return [...prev, data.statuses];
      });
      setCurrentGuess('');
      if (data.solved) {
        setSolved(true);
        playWin();
      } else if (data.attemptNumber >= 6) {
        playWrong();
      } else {
        playCorrect();
      }
    });

    const unsub4 = on('termo:roundEnd', (data: { word: string; winnerName: string | null; scores: { player1: number; player2: number }; round: number }) => {
      setScores(data.scores);
      setRoundResult(data);
    });

    const unsub5 = on('termo:gameOver', (data: { scores: { player1: number; player2: number }; winner: string | null }) => {
      setScores(data.scores);
      setGameOver(true);
      setFinalWinner(data.winner);
      playWin();
    });

    const unsub6 = on('game:playerLeft', (data: { playerName: string }) => {
      showError(`${data.playerName} saiu do jogo`).then(() => navigate(`/room/${roomId}`, { state: { from: 'termo' } }));
    });

    const unsub7 = on('room:backToRoom', () => {
      navigate(`/room/${roomId}`, { state: { from: 'termo' } });
    });

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsubTurn(); unsubRejoin();
    };
  }, [roomId, playerName, emit, on, navigate]);

  const handleKey = (key: string) => {
    if (!canType) return;
    playClick();
    if (key === 'ENTER') {
      if (currentGuess.length === COLS) {
        emit('termo:guess', { roomId, guess: currentGuess });
      }
    } else if (key === 'DEL') {
      setCurrentGuess(g => g.slice(0, -1));
    } else if (currentGuess.length < COLS) {
      setCurrentGuess(g => g + key);
    }
  };

  const resetGame = () => {
    emit('termo:reset', { roomId });
  };

  const goBack = () => {
    emit('room:backToRoom', { roomId });
    navigate(`/room/${roomId}`, { state: { from: 'termo' } });
  };

  // Keyboard letter colors from my statuses
  const keyColors: Record<string, string> = {};
  guesses.forEach((g, gi) => {
    (statuses[gi] || []).forEach((st, si) => {
      const letter = g[si];
      const priority = st === 'correct' ? 3 : st === 'present' ? 2 : 1;
      const current = keyColors[letter] === 'correct' ? 3 : keyColors[letter] === 'present' ? 2 : keyColors[letter] === 'absent' ? 1 : 0;
      if (priority > current) keyColors[letter] = st;
    });
  });

  const renderRow = (rowIndex: number) => {
    const rowGuess = guesses[rowIndex] || '';
    const rowStatus = statuses[rowIndex];
    const isCurrentRow = rowIndex === attempt && !solved && !roundResult && !gameOver;

    return (
      <div key={rowIndex} className="flex justify-center gap-1.5 mb-1.5">
        {Array.from({ length: COLS }).map((_, col) => {
          let letter = '';
          let status: CellStatus = 'empty';

          if (rowGuess[col]) {
            letter = rowGuess[col];
            status = rowStatus?.[col] || 'empty';
          } else if (isCurrentRow && currentGuess[col]) {
            letter = currentGuess[col];
            status = 'empty';
          }

          const colorClass =
            status === 'correct' ? 'bg-green-500 text-white border-green-600' :
            status === 'present' ? 'bg-yellow-400 text-white border-yellow-500' :
            status === 'absent' ? 'bg-gray-300 text-gray-500 border-gray-300' :
            isCurrentRow ? 'bg-white text-love-700 border-love-300 animate-pulse' : 'bg-white text-love-700 border-love-100';

          return (
            <motion.div
              key={col}
              initial={letter ? { scale: 0.7, rotateX: 90 } : {}}
              animate={{ scale: 1, rotateX: 0 }}
              className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg font-black text-xl border-2 shadow-sm ${colorClass}`}
            >
              {letter}
            </motion.div>
          );
        })}
      </div>
    );
  };

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
            <Keyboard size={20} className="text-love-500" />
            TERMO
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

        {/* Round & players */}
        <div className="flex justify-between items-center mb-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${currentTurn === 0 ? 'bg-love-500 text-white shadow-lg' : 'bg-white/80 text-love-600'}`}>
            <span className="font-bold text-sm">{players[0] || 'Jogador 1'}</span>
            {currentTurn === 0 && <Loader2 size={14} className="animate-spin" />}
            <span className="text-xs opacity-80">{scores.player1} pts</span>
          </div>
          <div className="text-center">
            <p className="pixel-font text-love-600 font-bold text-sm">RODADA {round}/5</p>
            <p className="text-love-400 text-xs">Palavra secreta • 1 por vez</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${currentTurn === 1 ? 'bg-love-500 text-white shadow-lg' : 'bg-white/80 text-love-600'}`}>
            <span className="text-xs opacity-80">{scores.player2} pts</span>
            {currentTurn === 1 && <Loader2 size={14} className="animate-spin" />}
            <span className="font-bold text-sm">{players[1] || 'Jogador 2'}</span>
          </div>
        </div>

        {/* Board */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 shadow-xl shadow-love-200/30 border-2 border-love-100 mb-4">
          {Array.from({ length: ROWS }).map((_, i) => renderRow(i))}

          {/* Status messages */}
          <div className="text-center mt-3 min-h-[1.5rem]">
            {solved && !roundResult && (
              <p className="text-green-600 font-bold text-sm flex items-center justify-center gap-1">
                <Check size={16} /> Acertou! Parabéns!
              </p>
            )}
            {!solved && !roundResult && !gameOver && !myTurn && (
              <p className="text-love-500 font-bold text-sm flex items-center justify-center gap-1">
                <Loader2 size={14} className="animate-spin" /> Vez de {turnName}...
              </p>
            )}
            {!solved && !roundResult && !gameOver && myTurn && (
              <p className="text-love-600 font-bold text-sm">Sua vez! Digite uma palavra de 5 letras</p>
            )}
          </div>
        </div>

        {/* Round result */}
        <AnimatePresence>
          {roundResult && !gameOver && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-lg border-2 border-love-100 mb-4 text-center"
            >
              <p className="text-love-500 text-sm font-bold">A palavra era:</p>
              <p className="text-3xl font-black tracking-[0.3em] text-love-700 my-2">{roundResult.word}</p>
              <p className="font-bold text-love-600">
                {roundResult.winnerName
                  ? `${roundResult.winnerName} venceu a rodada!`
                  : 'Empate na rodada!'}
              </p>
              <p className="text-love-400 text-xs mt-1">
                {roundResult.round < 5 ? 'Próxima rodada em breve...' : 'Calculando resultado final...'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game over */}
        <AnimatePresence>
          {gameOver && (
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
              <h2 className="text-2xl font-black text-love-700 mb-4">Fim de Jogo!</h2>
              <div className="flex justify-center gap-8 mb-4">
                <div className="text-center">
                  <p className="text-love-500 text-sm font-bold">{players[0]}</p>
                  <p className="text-3xl font-black text-love-600">{scores.player1}</p>
                </div>
                <div className="text-center">
                  <p className="text-love-500 text-sm font-bold">{players[1]}</p>
                  <p className="text-3xl font-black text-love-600">{scores.player2}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-love-600 mb-4">
                {finalWinner ? `${finalWinner} venceu!` : 'Empate!'}
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

        {/* Keyboard */}
        {!gameOver && (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-3 shadow-lg border-2 border-love-100">
            {KEY_ROWS.map((row, i) => (
              <div key={i} className="flex justify-center gap-1 mb-1">
                {row.map((key) => {
                  const isAction = key === 'ENTER' || key === 'DEL';
                  const color = keyColors[key];
                  const keyClass =
                    color === 'correct' ? 'bg-green-500 text-white' :
                    color === 'present' ? 'bg-yellow-400 text-white' :
                    color === 'absent' ? 'bg-gray-300 text-gray-500' :
                    'bg-love-50 text-love-700';
                  return (
                    <button
                      key={key}
                      onClick={() => handleKey(key)}
                      disabled={!canType}
                      className={`${isAction ? 'px-2 text-xs flex-1 max-w-[3.5rem]' : 'w-8 h-10 sm:w-9 sm:h-11'} h-10 sm:h-11 rounded-md font-black ${keyClass} flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform`}
                    >
                      {key === 'DEL' ? <Delete size={16} /> : key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}