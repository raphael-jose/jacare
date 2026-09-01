import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Heart, ArrowRight } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useSounds } from '../hooks/useSounds';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

const loveWords = [
  'AMOR', 'BEIJO', 'CARINHO', 'TESAO', ' paixão', 'ROMANCE', 'CASAL', 'CORACAO',
  'FELICIDADE', 'JUNTOS', 'PARCEIRO', 'COMPANHEIRO', 'ENCHENTE', 'APERTO',
  'CIUMES', 'FOTINHO', 'MENSAGEM', 'WPP', 'NETFLIX', 'PIZZA', 'CHOCOLATE',
  'FLORES', 'VELAS', 'MUSICA', 'DANCA', 'SORRISO', 'ABRACO', 'CALOR',
];

export default function Hangman() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playCorrect, playWrong, playWin, playLose, playClick } = useSounds();
  
  const playerName = searchParams.get('name') || 'Jogador';
  const avatar = searchParams.get('avatar') || '🐱';
  
  const [myRole, setMyRole] = useState<'chooser' | 'guesser' | null>(null);
  const [word, setWord] = useState('');
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [maxWrong] = useState(6);
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'won' | 'lost'>('setup');
  const [wordHint, setWordHint] = useState('');
  const [players, setPlayers] = useState<{ chooser: string; guesser: string }>({ chooser: '', guesser: '' });
  const [customWord, setCustomWord] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    emit('game:join', { roomId, gameType: 'hangman', playerName });

    const unsub1 = on('game:assigned', (data: { role: string; players: any }) => {
      setMyRole(data.role as 'chooser' | 'guesser');
      setPlayers(data.players);
    });

    const unsub2 = on('hangman:start', (data: { word: string; hint: string }) => {
      setWord(data.word);
      setWordHint(data.hint);
      setGameState('playing');
      setGuessedLetters(new Set());
      setWrongGuesses(0);
    });

    const unsub3 = on('hangman:guess', (data: { letter: string; isCorrect: boolean }) => {
      setGuessedLetters(prev => new Set([...prev, data.letter]));
      if (data.isCorrect) {
        playCorrect();
      } else {
        setWrongGuesses(prev => prev + 1);
        playWrong();
      }
    });

    const unsub4 = on('hangman:win', () => {
      setGameState('won');
      playWin();
    });

    const unsub5 = on('hangman:lose', (data: { word: string }) => {
      setWord(data.word);
      setGameState('lost');
      playLose();
    });

    const unsub6 = on('hangman:message', (data: { text: string }) => {
      setMessage(data.text);
      setTimeout(() => setMessage(''), 3000);
    });

    const unsub7 = on('hangman:reset', () => {
      setGameState('setup');
      setGuessedLetters(new Set());
      setWrongGuesses(0);
      setCustomWord('');
      setShowInput(false);
    });

    const unsub8 = on('game:playerLeft', (data: { playerName: string }) => {
      alert(`${data.playerName} saiu do jogo 😢`);
      navigate('/');
    });

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8();
    };
  }, [roomId, playerName, emit, on, navigate]);

  const submitWord = () => {
    if (customWord.trim().length < 2) return;
    emit('hangman:word', { roomId, word: customWord.trim().toUpperCase() });
    setShowInput(false);
  };

  const guessLetter = (letter: string) => {
    if (guessedLetters.has(letter) || gameState !== 'playing' || myRole !== 'guesser') return;
    emit('hangman:guess', { roomId, letter });
  };

  const resetGame = () => {
    emit('hangman:reset', { roomId });
  };

  const getDisplayWord = () => {
    return word.split('').map(letter => 
      guessedLetters.has(letter) ? letter : '_'
    ).join(' ');
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Hangman drawing stages
  const hangmanStages = [
    // Stage 0: Empty
    <svg key="0" viewBox="0 0 120 120" className="w-full h-full">
      <line x1="20" y1="110" x2="100" y2="110" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="110" x2="30" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="20" x2="70" y2="20" stroke="#fda4af" strokeWidth="3"/>
    </svg>,
    // Stage 1: Head
    <svg key="1" viewBox="0 0 120 120" className="w-full h-full">
      <line x1="20" y1="110" x2="100" y2="110" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="110" x2="30" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="20" x2="70" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <circle cx="70" cy="35" r="15" fill="none" stroke="#f43f5e" strokeWidth="3"/>
    </svg>,
    // Stage 2: Body
    <svg key="2" viewBox="0 0 120 120" className="w-full h-full">
      <line x1="20" y1="110" x2="100" y2="110" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="110" x2="30" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="20" x2="70" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <circle cx="70" cy="35" r="15" fill="none" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="50" x2="70" y2="80" stroke="#f43f5e" strokeWidth="3"/>
    </svg>,
    // Stage 3: Arms
    <svg key="3" viewBox="0 0 120 120" className="w-full h-full">
      <line x1="20" y1="110" x2="100" y2="110" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="110" x2="30" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="20" x2="70" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <circle cx="70" cy="35" r="15" fill="none" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="50" x2="70" y2="80" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="60" x2="55" y2="70" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="60" x2="85" y2="70" stroke="#f43f5e" strokeWidth="3"/>
    </svg>,
    // Stage 4: Legs
    <svg key="4" viewBox="0 0 120 120" className="w-full h-full">
      <line x1="20" y1="110" x2="100" y2="110" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="110" x2="30" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="20" x2="70" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <circle cx="70" cy="35" r="15" fill="none" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="50" x2="70" y2="80" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="60" x2="55" y2="70" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="60" x2="85" y2="70" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="80" x2="55" y2="100" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="80" x2="85" y2="100" stroke="#f43f5e" strokeWidth="3"/>
    </svg>,
    // Stage 5: Dead
    <svg key="5" viewBox="0 0 120 120" className="w-full h-full">
      <line x1="20" y1="110" x2="100" y2="110" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="110" x2="30" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="20" x2="70" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <circle cx="70" cy="35" r="15" fill="none" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="50" x2="70" y2="80" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="60" x2="55" y2="70" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="60" x2="85" y2="70" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="80" x2="55" y2="100" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="80" x2="85" y2="100" stroke="#f43f5e" strokeWidth="3"/>
      {/* X eyes */}
      <line x1="63" y1="30" x2="69" y2="36" stroke="#f43f5e" strokeWidth="2"/>
      <line x1="69" y1="30" x2="63" y2="36" stroke="#f43f5e" strokeWidth="2"/>
      <line x1="71" y1="30" x2="77" y2="36" stroke="#f43f5e" strokeWidth="2"/>
      <line x1="77" y1="30" x2="71" y2="36" stroke="#f43f5e" strokeWidth="2"/>
      {/* Sad mouth */}
      <path d="M64 42 Q70 38 76 42" fill="none" stroke="#f43f5e" strokeWidth="2"/>
    </svg>,
    // Stage 6: Lost
    <svg key="6" viewBox="0 0 120 120" className="w-full h-full">
      <line x1="20" y1="110" x2="100" y2="110" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="110" x2="30" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <line x1="30" y1="20" x2="70" y2="20" stroke="#fda4af" strokeWidth="3"/>
      <circle cx="70" cy="35" r="15" fill="none" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="50" x2="70" y2="80" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="60" x2="55" y2="70" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="60" x2="85" y2="70" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="80" x2="55" y2="100" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="70" y1="80" x2="85" y2="100" stroke="#f43f5e" strokeWidth="3"/>
      <line x1="63" y1="30" x2="69" y2="36" stroke="#f43f5e" strokeWidth="2"/>
      <line x1="69" y1="30" x2="63" y2="36" stroke="#f43f5e" strokeWidth="2"/>
      <line x1="71" y1="30" x2="77" y2="36" stroke="#f43f5e" strokeWidth="2"/>
      <line x1="77" y1="30" x2="71" y2="36" stroke="#f43f5e" strokeWidth="2"/>
      <path d="M64 42 Q70 38 76 42" fill="none" stroke="#f43f5e" strokeWidth="2"/>
      {/* Dead X */}
      <text x="68" y="95" fontSize="20" fill="#f43f5e" fontWeight="bold">💀</text>
    </svg>,
  ];

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
            Voltar
          </motion.button>
          <h1 className="text-xl font-black text-love-700">Jogo da Forca 💝</h1>
          {gameState !== 'setup' && (
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

        {/* Players info */}
        <div className="flex justify-between items-center mb-4 text-sm">
          <div className={`px-3 py-1 rounded-full ${myRole === 'chooser' ? 'bg-love-500 text-white' : 'bg-love-100 text-love-600'}`}>
            🎯 {players.chooser || 'Esperando...'}
          </div>
          <div className={`px-3 py-1 rounded-full ${myRole === 'guesser' ? 'bg-love-500 text-white' : 'bg-love-100 text-love-600'}`}>
            🔤 {players.guesser || 'Esperando...'}
          </div>
        </div>

        {/* Message */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center mb-4 p-3 bg-love-100 rounded-2xl text-love-700 font-bold"
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        {gameState === 'setup' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-love-200/30 border-2 border-love-100"
          >
            {myRole === 'chooser' ? (
              <div className="text-center">
                <span className="text-5xl mb-4 block">🎯</span>
                <h2 className="text-xl font-bold text-love-700 mb-2">Escolha a palavra!</h2>
                <p className="text-love-500 text-sm mb-4">
                  Digite uma palavra para seu amor adivinhar 💕
                </p>
                <input
                  type="text"
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value.toUpperCase())}
                  placeholder="Digite a palavra..."
                  className="input-love text-center text-xl font-bold tracking-widest uppercase mb-4"
                  maxLength={20}
                  onKeyPress={(e) => e.key === 'Enter' && submitWord()}
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={submitWord}
                  disabled={customWord.trim().length < 2}
                  className="w-full btn-love disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enviar Palavra 💕
                </motion.button>
              </div>
            ) : (
              <div className="text-center py-8">
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-5xl mb-4"
                >
                  ⏳
                </motion.div>
                <h2 className="text-xl font-bold text-love-700 mb-2">Esperando...</h2>
                <p className="text-love-500">
                  Seu amor está escolhendo a palavra! 🥰
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <>
            {/* Hangman drawing */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 shadow-xl shadow-love-200/30 border-2 border-love-100 mb-4">
              <div className="w-32 h-32 mx-auto">
                {hangmanStages[Math.min(wrongGuesses, 6)]}
              </div>
              
              {/* Wrong guesses indicator */}
              <div className="flex justify-center gap-1 mt-2">
                {Array.from({ length: maxWrong }).map((_, i) => (
                  <Heart
                    key={i}
                    size={16}
                    className={i < wrongGuesses ? 'text-love-300' : 'text-love-500'}
                    fill={i < wrongGuesses ? 'currentColor' : 'none'}
                  />
                ))}
              </div>
            </div>

            {/* Word display */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-love-200/30 border-2 border-love-100 mb-4">
              <div className="text-center">
                <p className="text-love-400 text-sm mb-2">Palavra:</p>
                <motion.div 
                  className="text-4xl font-black text-love-700 tracking-[0.2em] mb-2"
                  animate={{ scale: gameState === 'won' ? [1, 1.2, 1] : 1 }}
                >
                  {word.split('').map((letter, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`inline-block mx-0.5 ${
                        guessedLetters.has(letter) ? 'text-love-600' : 'text-gray-300'
                      }`}
                    >
                      {guessedLetters.has(letter) || gameState === 'lost' ? letter : '•'}
                    </motion.span>
                  ))}
                </motion.div>
                {gameState === 'lost' && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-love-400 text-sm mt-2"
                  >
                    A resposta era: <span className="font-bold text-love-600">{word}</span>
                  </motion.p>
                )}
                {gameState === 'won' && (
                  <motion.p
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-lg font-bold text-love-500 mt-2"
                  >
                    🎉 Parabéns! Você acertou! 🎉
                  </motion.p>
                )}
                {gameState === 'lost' && (
                  <motion.p
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-lg font-bold text-love-500 mt-2"
                  >
                    😢 Não foi dessa vez...
                  </motion.p>
                )}
              </div>
            </div>

            {/* Keyboard */}
            {gameState === 'playing' && myRole === 'guesser' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 shadow-xl shadow-love-200/30 border-2 border-love-100">
                <div className="grid grid-cols-7 gap-2">
                  {alphabet.map((letter) => (
                    <motion.button
                      key={letter}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => guessLetter(letter)}
                      disabled={guessedLetters.has(letter)}
                      className={`w-full aspect-square rounded-xl font-bold text-sm transition-all
                                 ${guessedLetters.has(letter) 
                                   ? word.includes(letter) 
                                     ? 'bg-love-500 text-white' 
                                     : 'bg-gray-200 text-gray-400'
                                   : 'bg-love-100 text-love-700 hover:bg-love-200'
                                 }`}
                    >
                      {letter}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {gameState === 'playing' && myRole === 'chooser' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-love-200/30 border-2 border-love-100 text-center">
                <motion.div
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-4xl mb-3"
                >
                  👀
                </motion.div>
                <p className="text-love-600 font-bold">
                  Seu amor está tentando adivinhar!
                </p>
                <p className="text-love-400 text-sm mt-1">
                  Torça para ele/ela acertar! 💕
                </p>
              </div>
            )}

            {(gameState === 'won' || gameState === 'lost') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mt-4"
              >
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
          </>
        )}
      </motion.div>

      <Chat roomId={roomId || ''} playerName={playerName} />
      <Scoreboard roomId={roomId || ''} playerName={playerName} />
    </div>
  );
}
