import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, TrendingUp } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

interface ScoreboardData {
  [playerName: string]: {
    tictactoe: number;
    hangman: number;
    memory: number;
    words: number;
    snake: number;
    runner: number;
    dodgeball: number;
    kitchen: number;
    total: number;
  };
}

interface ScoreboardProps {
  roomId: string;
  playerName: string;
}

const GAME_INFO: Record<string, { emoji: string; name: string }> = {
  tictactoe: { emoji: '❌⭕', name: 'Velha' },
  hangman: { emoji: '🎯', name: 'Forca' },
  memory: { emoji: '🧠', name: 'Memoria' },
  words: { emoji: '✍️', name: 'Palavras' },
  snake: { emoji: '🐍', name: 'Cobras' },
  runner: { emoji: '🏃', name: 'Runner' },
  dodgeball: { emoji: '🤾', name: 'Dodgeball' },
  kitchen: { emoji: '🍳', name: 'Cozinha' },
};

export default function Scoreboard({ roomId, playerName }: ScoreboardProps) {
  const { emit, on } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [scoreboard, setScoreboard] = useState<ScoreboardData>({});
  const [players, setPlayers] = useState<string[]>([]);

  useEffect(() => {
    emit('scoreboard:get', { roomId });

    const unsub1 = on('scoreboard:data', (data: { scoreboard: ScoreboardData; players: string[] }) => {
      setScoreboard(data.scoreboard);
      setPlayers(data.players);
    });

    const unsub2 = on('scoreboard:update', (data: { scoreboard: ScoreboardData }) => {
      setScoreboard(data.scoreboard);
    });

    return () => { unsub1(); unsub2(); };
  }, [roomId, emit, on]);

  const sortedPlayers = Object.entries(scoreboard)
    .sort(([, a], [, b]) => b.total - a.total);

  return (
    <>
      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 
                   flex items-center justify-center shadow-lg shadow-amber-300/50 text-white"
      >
        <Trophy size={24} />
      </motion.button>

      {/* Scoreboard panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            className="fixed bottom-24 left-6 z-50 w-80 bg-white/95 backdrop-blur-sm rounded-3xl 
                       shadow-2xl shadow-amber-200/30 border-2 border-amber-100 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Trophy size={16} /> Placar Geral
                </h3>
                <p className="text-amber-100 text-xs">Vitorias em todos os jogos</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {sortedPlayers.length === 0 ? (
                <div className="text-center py-6 text-amber-400">
                  <p className="text-3xl mb-2">🏆</p>
                  <p className="text-sm font-bold">Nenhum jogo ainda</p>
                  <p className="text-xs mt-1">Joguem para ver o placar!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedPlayers.map(([name, scores], index) => (
                    <motion.div
                      key={name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`rounded-2xl p-3 border-2 ${
                        index === 0 && scores.total > 0
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      {/* Player header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {index === 0 ? '👑' : index === 1 ? '🥈' : '🥉'}
                          </span>
                          <span className={`font-bold text-sm ${name === playerName ? 'text-amber-600' : 'text-gray-700'}`}>
                            {name}
                            {name === playerName && <span className="text-xs text-amber-400 ml-1">(voce)</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded-full">
                          <TrendingUp size={12} className="text-amber-600" />
                          <span className="text-amber-700 font-bold text-sm">{scores.total}</span>
                        </div>
                      </div>

                      {/* Game breakdown */}
                      <div className="grid grid-cols-4 gap-1">
                        {Object.entries(GAME_INFO).map(([key, info]) => (
                          <div key={key} className="text-center">
                            <span className="text-xs">{info.emoji}</span>
                            <p className={`text-xs font-bold ${
                              (scores as any)[key] > 0 ? 'text-amber-600' : 'text-gray-300'
                            }`}>
                              {(scores as any)[key] || 0}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
