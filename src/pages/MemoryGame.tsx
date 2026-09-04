import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Heart, Trophy, Timer, Brain, LogOut, Gift, Star, Music, Cake, Flower2, Moon, Sun } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';
import { showError } from '../utils/alert';
import { getPlayerInfo } from '../utils/player';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const CARD_ICONS: Record<string, any> = {
  heart: Heart,
  star: Star,
  music: Music,
  gift: Gift,
  cake: Cake,
  flower: Flower2,
  moon: Moon,
  sun: Sun,
};

export default function MemoryGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playFlip, playMatch, playWrong, playWin } = useSounds();
  
  const { name: playerName, avatar } = getPlayerInfo();
  
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [scores, setScores] = useState<{ player1: number; player2: number }>({ player1: 0, player2: 0 });
  const [players, setPlayers] = useState<string[]>([]);
  const [myIndex, setMyIndex] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [timer, setTimer] = useState(0);

  // Timer
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [gameStarted, gameOver]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    emit('game:join', { roomId, gameType: 'memory', playerName });

    const unsub1 = on('game:assigned', (data: { playerIndex: number; players: string[] }) => {
      setMyIndex(data.playerIndex);
      setPlayers(data.players);
    });

    const unsub2 = on('memory:start', (data: { cards: Card[]; currentTurn: number }) => {
      setCards(data.cards);
      setCurrentTurn(data.currentTurn);
      setGameStarted(true);
      setFlippedCards([]);
      setMatchedPairs(0);
      setMoves(0);
      setTimer(0);
      setGameOver(false);
    });

    const unsub3 = on('memory:flip', (data: { cardIndex: number; card: Card }) => {
      setCards(prev => prev.map((c, i) => i === data.cardIndex ? data.card : c));
      setFlippedCards(prev => [...prev, data.cardIndex]);
      playFlip();
    });

    const unsub4 = on('memory:match', (data: { card1: number; card2: number; scores: any; currentTurn: number }) => {
      setCards(prev => prev.map((c, i) => {
        if (i === data.card1 || i === data.card2) return { ...c, isMatched: true };
        return c;
      }));
      setMatchedPairs(prev => prev + 1);
      playMatch();
      setScores(data.scores);
      setCurrentTurn(data.currentTurn);
      setFlippedCards([]);
    });

    const unsub5 = on('memory:noMatch', (data: { card1: number; card2: number; currentTurn: number }) => {
      playWrong();
      setTimeout(() => {
        setCards(prev => prev.map((c, i) => {
          if (i === data.card1 || i === data.card2) return { ...c, isFlipped: false };
          return c;
        }));
        setCurrentTurn(data.currentTurn);
        setFlippedCards([]);
      }, 1000);
    });

    const unsub6 = on('memory:gameOver', (data: { scores: any }) => {
      setScores(data.scores);
      setGameOver(true);
      playWin();
    });

    const unsub7 = on('game:playerLeft', (data: { playerName: string }) => {
      showError(`${data.playerName} saiu do jogo`);
      navigate(`/room/${roomId}`, { state: { from: 'memory' } });
    });
    const unsub8 = on('room:backToRoom', () => {
      navigate(`/room/${roomId}`, { state: { from: 'memory' } });
    });

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8();
    };
  }, [roomId, playerName, emit, on, navigate]);

  const handleCardClick = (index: number) => {
    if (!gameStarted || gameOver) return;
    if (cards[index].isFlipped || cards[index].isMatched) return;
    if (flippedCards.length >= 2) return;
    if (currentTurn !== myIndex) return;

    emit('memory:flip', { roomId, cardIndex: index });
  };

  const resetGame = () => {
    emit('memory:reset', { roomId });
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
            onClick={() => { emit('room:backToRoom', { roomId }); navigate(`/room/${roomId}`, { state: { from: 'memory' } }); }}
            className="flex items-center gap-2 text-love-600 font-bold"
          >
            <ArrowLeft size={20} />
            Trocar Jogo
          </motion.button>
          <h1 className="pixel-font text-sm font-black text-love-700 flex items-center gap-2">
            <Brain size={18} className="text-love-500" />
            JOGO DA MEMÓRIA
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
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} className="text-red-400 font-bold text-xs">
              <LogOut size={14} /> Sair
            </motion.button>
          </div>
        </div>

        {/* Players & Stats */}
        <div className="flex justify-between items-center mb-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${currentTurn === myIndex ? 'bg-love-500 text-white' : 'bg-white/80 text-love-600'}`}>
            <Heart size={16} fill={currentTurn === myIndex ? 'white' : 'currentColor'} />
            <span className="font-bold text-sm">{players[myIndex] || 'Você'}</span>
            <span className="text-xs opacity-80">{scores.player1} pares</span>
          </div>
          
          <div className="flex items-center gap-3 text-love-500 text-sm">
            <div className="flex items-center gap-1">
              <Timer size={14} />
              <span className="font-bold">{formatTime(timer)}</span>
            </div>
            <div className="font-bold">{moves} jogadas</div>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${currentTurn !== myIndex ? 'bg-love-500 text-white' : 'bg-white/80 text-love-600'}`}>
            <span className="text-xs opacity-80">{scores.player2} pares</span>
            <span className="font-bold text-sm">{players[1 - myIndex] || 'Oponente'}</span>
            <Heart size={16} fill={currentTurn !== myIndex ? 'white' : 'currentColor'} />
          </div>
        </div>

        {/* Turn indicator */}
        <div className="text-center mb-4">
          {gameStarted && !gameOver && (
            <p className={`font-bold ${currentTurn === myIndex ? 'text-love-600 animate-pulse' : 'text-love-400'}`}>
              {currentTurn === myIndex ? 'Sua vez!' : `Aguardando ${players[currentTurn]}...`}
            </p>
          )}
          {gameOver && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center justify-center gap-2"
            >
              <Trophy className="text-love-500" />
              <span className="font-bold text-love-600">
                {scores.player1 > scores.player2 ? 'Voce ganhou!' : 
                 scores.player1 < scores.player2 ? `${players[1 - myIndex]} ganhou!` :
                 'Empate!'}
              </span>
            </motion.div>
          )}
        </div>

        {/* Game board */}
        {gameStarted ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 shadow-xl shadow-love-200/30 border-2 border-love-100">
            <div className="grid grid-cols-4 gap-2">
              {cards.map((card, index) => (
                <motion.button
                  key={card.id}
                  whileHover={{ scale: card.isFlipped || card.isMatched ? 1 : 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCardClick(index)}
                  disabled={card.isFlipped || card.isMatched || currentTurn !== myIndex}
                  className={`aspect-square rounded-2xl flex items-center justify-center text-2xl
                             transition-all duration-300
                             ${card.isMatched 
                               ? 'bg-gradient-to-br from-love-200 to-love-300 shadow-inner' 
                               : card.isFlipped 
                                 ? 'bg-white border-2 border-love-300 shadow-lg' 
                                 : 'bg-gradient-to-br from-love-400 to-love-600 shadow-md hover:shadow-lg'
                             }`}
                >
                  <AnimatePresence mode="wait">
                    {card.isFlipped || card.isMatched ? (
                      <motion.span
                        key="front"
                        initial={{ rotateY: 90 }}
                        animate={{ rotateY: 0 }}
                        exit={{ rotateY: 90 }}
                        transition={{ duration: 0.3 }}
                        className={card.isMatched ? 'opacity-60 flex' : 'flex'}
                      >
                        {(() => {
                          const Face = CARD_ICONS[card.emoji] || Heart;
                          return <Face size={26} className="text-love-600" />;
                        })()}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="back"
                        initial={{ rotateY: 0 }}
                        animate={{ rotateY: 0 }}
                        exit={{ rotateY: 90 }}
                      >
                        <Heart size={26} className="text-white" fill="white" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl shadow-love-200/30 border-2 border-love-100 text-center">
            <motion.div
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-5xl mb-4 flex items-center justify-center"
            >
              <Timer size={52} className="text-love-300" />
            </motion.div>
            <p className="text-love-500 font-bold">
              Esperando os jogadores...
            </p>
          </div>
        )}

        {/* Progress bar */}
        {gameStarted && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-love-500 mb-1">
              <span>Pares encontrados</span>
              <span className="font-bold">{matchedPairs} / {cards.length / 2}</span>
            </div>
            <div className="h-2 bg-love-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-love-400 to-love-600"
                initial={{ width: 0 }}
                animate={{ width: `${(matchedPairs / (cards.length / 2)) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </motion.div>

      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}
