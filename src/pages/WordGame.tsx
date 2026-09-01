import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Heart, Zap, Check, X, ArrowRight } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

const CATEGORIES = [
  { name: 'Coisas de casal', emoji: '💑', words: ['abracar', 'beijar', 'carinho', 'namoro', 'jantar', 'flores', 'chocolate', 'cinema', 'viagem', 'festa', 'musica', 'danca', 'sorriso', 'abraço', 'tesao'] },
  { name: 'Comida', emoji: '🍕', words: ['pizza', 'chocolate', 'sushi', 'sorvete', 'bolo', 'pipoca', 'hamburguer', 'açaí', 'pastel', 'acai'] },
  { name: 'Animais', emoji: '🐾', words: ['gato', 'cachorro', 'coelho', 'borboleta', 'passaro', 'tartaruga', 'panda', 'cavalo', 'peixe'] },
];

export default function WordGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playClick, playCorrect, playWrong, playWin } = useSounds();
  
  const playerName = searchParams.get('name') || 'Jogador';
  const avatar = searchParams.get('avatar') || '🐱';
  
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'roundEnd' | 'gameOver'>('lobby');
  const [currentWord, setCurrentWord] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [input, setInput] = useState('');
  const [round, setRound] = useState(1);
  const [maxRounds] = useState(5);
  const [timeLeft, setTimeLeft] = useState(30);
  const [scores, setScores] = useState<{ player1: number; player2: number }>({ player1: 0, player2: 0 });
  const [players, setPlayers] = useState<string[]>([]);
  const [myIndex, setMyIndex] = useState(0);
  const [results, setResults] = useState<{ player: string; correct: boolean; word: string }[]>([]);
  const [opponentDone, setOpponentDone] = useState(false);
  const [roundWords, setRoundWords] = useState<{ player1: string; player2: string }>({ player1: '', player2: '' });
  const inputRef = useRef<HTMLInputElement>(null);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing' || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          emit('words:timeUp', { roomId });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, timeLeft, roomId, emit]);

  useEffect(() => {
    if (gameState === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState, currentWord]);

  useEffect(() => {
    emit('game:join', { roomId, gameType: 'words', playerName });

    const unsub1 = on('game:assigned', (data: { playerIndex: number; players: string[] }) => {
      setMyIndex(data.playerIndex);
      setPlayers(data.players);
    });

    const unsub2 = on('words:start', (data: { word: string; category: string; timeLimit: number; round: number }) => {
      setCurrentWord(data.word);
      setCurrentCategory(data.category);
      setTimeLeft(data.timeLimit);
      setRound(data.round);
      setGameState('playing');
      setInput('');
      setOpponentDone(false);
      setResults([]);
      setRoundWords({ player1: '', player2: '' });
    });

    const unsub3 = on('words:opponentDone', () => {
      setOpponentDone(true);
    });

    const unsub4 = on('words:roundResult', (data: { 
      results: { player: string; correct: boolean; word: string }[];
      scores: any;
      roundWords: { player1: string; player2: string };
    }) => {
      setResults(data.results);
      setScores(data.scores);
      setRoundWords(data.roundWords);
      setGameState('roundEnd');
      // Play sound based on result
      const myResult = data.results[myIndex];
      if (myResult?.correct) playCorrect(); else playWrong();
    });

    const unsub5 = on('words:gameOver', (data: { scores: any; winner: string }) => {
      setScores(data.scores);
      setGameState('gameOver');
      playWin();
    });

    const unsub6 = on('words:submitted', (data: { playerIndex: number }) => {
      if (data.playerIndex !== myIndex) {
        setOpponentDone(true);
      }
    });

    const unsub7 = on('game:playerLeft', (data: { playerName: string }) => {
      alert(`${data.playerName} saiu do jogo 😢`);
      navigate(`/room/${roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}`);
    });

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7();
    };
  }, [roomId, playerName, emit, on, navigate, myIndex]);

  const submitWord = () => {
    if (!input.trim() || gameState !== 'playing') return;
    playClick();
    emit('words:submit', { roomId, word: input.trim().toLowerCase() });
  };

  const resetGame = () => {
    emit('words:reset', { roomId });
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(`/room/${roomId}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(avatar)}`)}
            className="flex items-center gap-2 text-love-600 font-bold"
          >
            <ArrowLeft size={20} />
            Trocar Jogo
          </motion.button>
          <h1 className="text-xl font-black text-love-700">Palavras ✍️</h1>
          <div className="flex gap-2">
            {(gameState === 'roundEnd' || gameState === 'gameOver') && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={resetGame}
                className="p-2 rounded-full bg-love-100 text-love-600"
              >
                <RotateCcw size={20} />
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} className="text-red-400 font-bold text-xs">
              🚪 Sair
            </motion.button>
          </div>
        </div>

        {/* Players */}
        <div className="flex justify-between items-center mb-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${gameState === 'playing' ? 'bg-love-500 text-white' : 'bg-white/80 text-love-600'}`}>
            <span className="font-bold text-sm">{players[myIndex] || 'Você'}</span>
            <span className="text-xs opacity-80">{scores.player1} pts</span>
          </div>
          <div className="flex items-center gap-2 text-love-400">
            <span className="font-bold text-sm">Rodada {round}/{maxRounds}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${gameState !== 'lobby' ? 'bg-love-500 text-white' : 'bg-white/80 text-love-600'}`}>
            <span className="text-xs opacity-80">{scores.player2} pts</span>
            <span className="font-bold text-sm">{players[1 - myIndex] || 'Oponente'}</span>
          </div>
        </div>

        {gameState === 'playing' && (
          <>
            {/* Timer & Category */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-love-500">
                <span className="text-2xl">{CATEGORIES.find(c => c.name === currentCategory)?.emoji}</span>
                <span className="font-bold text-sm">{currentCategory}</span>
              </div>
              <motion.div 
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold ${
                  timeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-love-100 text-love-600'
                }`}
                animate={timeLeft <= 5 ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                ⏱️ {timeLeft}s
              </motion.div>
            </div>

            {/* Word to write */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-love-200/30 border-2 border-love-100 mb-4 text-center">
              <p className="text-love-400 text-sm mb-2">Escreva esta palavra:</p>
              <motion.h2 
                className="text-3xl font-black text-love-700 mb-4"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {currentWord.toUpperCase()}
              </motion.h2>
              
              {/* Input */}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.toLowerCase())}
                  onKeyPress={(e) => e.key === 'Enter' && submitWord()}
                  placeholder="Digite a palavra..."
                  className="input-love flex-1 text-center text-xl font-bold tracking-widest uppercase"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={submitWord}
                  disabled={!input.trim()}
                  className="btn-love px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={20} />
                </motion.button>
              </div>

              {/* Status indicators */}
              <div className="flex justify-center gap-4 mt-4">
                {opponentDone && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1 text-love-500 text-sm font-bold"
                  >
                    <Zap size={14} />
                    Oponente já enviou!
                  </motion.div>
                )}
              </div>
            </div>

            {/* Quick tips */}
            <div className="text-center text-love-400 text-xs">
              <p>💡 Dica: Digite rápido para ganhar mais pontos!</p>
            </div>
          </>
        )}

        {gameState === 'roundEnd' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-love-200/30 border-2 border-love-100"
          >
            <h2 className="text-xl font-bold text-love-700 text-center mb-4">
              Resultado da Rodada 🎯
            </h2>

            <div className="space-y-3">
              {results.map((result, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.2 }}
                  className={`flex items-center justify-between p-3 rounded-2xl ${
                    result.correct ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.correct ? (
                      <Check className="text-green-500" size={20} />
                    ) : (
                      <X className="text-red-500" size={20} />
                    )}
                    <span className="font-bold text-gray-700">{result.player}</span>
                  </div>
                  <span className={`font-bold ${result.correct ? 'text-green-600' : 'text-red-600'}`}>
                    {result.correct ? `✅ ${result.word.toUpperCase()}` : '❌ Errou!'}
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 text-center">
              <p className="text-love-500 font-bold">
                {round < maxRounds ? 'Próxima rodada em breve...' : 'Calculando resultado final...'}
              </p>
            </div>
          </motion.div>
        )}

        {gameState === 'gameOver' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-love-200/30 border-2 border-love-100 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-6xl mb-4"
            >
              🏆
            </motion.div>
            <h2 className="text-2xl font-black text-love-700 mb-4">Fim de Jogo!</h2>
            
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
              {scores.player1 > scores.player2 ? '🎉 Você venceu!' : 
               scores.player1 < scores.player2 ? '💕 Seu amor venceu!' :
               '🤝 Empate!'}
            </p>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetGame}
              className="btn-love"
            >
              <RotateCcw className="inline w-5 h-5 mr-2" />
              Jogar Novamente 💕
            </motion.button>
          </motion.div>
        )}
      </motion.div>

      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}
