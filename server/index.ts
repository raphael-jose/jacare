import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { randomBytes } from 'crypto';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Types
interface Room {
  id: string;
  gameType: string | null;
  players: { id: string; name: string; avatar: string }[];
  state: any;
  maxPlayers: number;
  messages: { id: string; sender: string; text: string; time: number }[];
  scoreboard: { [playerName: string]: { tictactoe: number; hangman: number; memory: number; words: number; total: number } };
}

// Game rooms storage
const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

const LOVE_WORDS = [
  'AMOR', 'BEIJO', 'CARINHO', 'TESAO', 'PAIXAO', 'ROMANCE', 'CASAL', 'CORACAO',
  'FELICIDADE', 'JUNTOS', 'PARCEIRO', 'COMPANHEIRO', 'ENCHENTE', 'APERTO',
  'CIUMES', 'FOTINHO', 'MENSAGEM', 'WPP', 'NETFLIX', 'PIZZA', 'CHOCOLATE',
  'FLORES', 'VELAS', 'MUSICA', 'DANCA', 'SORRISO', 'ABRACO', 'CALOR',
];

const WORD_CATEGORIES = [
  { name: 'Coisas de casal', emoji: '💑', words: ['abracar', 'beijar', 'carinho', 'namoro', 'jantar', 'flores', 'chocolate', 'cinema', 'viagem', 'festa', 'musica', 'danca', 'sorriso', 'abraco'] },
  { name: 'Comida', emoji: '🍕', words: ['pizza', 'chocolate', 'sushi', 'sorvete', 'bolo', 'pipoca', 'hamburguer', 'acai', 'pastel'] },
  { name: 'Animais', emoji: '🐾', words: ['gato', 'cachorro', 'coelho', 'borboleta', 'passaro', 'tartaruga', 'panda', 'cavalo', 'peixe'] },
];

const LOVE_EMOJIS = ['💕', '💗', '💖', '💘', '💝', '🥰', '😍', '💑', '💏', '🌹', '🦋', '✨', '🎵', '🎁', '🍓'];

// Chat message
interface ChatMessage {
  id: string;
  sender: string;
  avatar: string;
  text: string;
  time: number;
}

// Connection handler
io.on('connection', (socket: Socket) => {
  console.log(`✨ Conectou: ${socket.id}`);

  // ===== ROOM MANAGEMENT =====

  // Room creation (no gameType needed)
  socket.on('room:create', ({ playerName, avatar }: { playerName: string; avatar: string }) => {
    const roomId = generateRoomCode();
    const room: Room = {
      id: roomId,
      gameType: null,
      players: [{ id: socket.id, name: playerName, avatar: avatar || '🐱' }],
      state: {},
      maxPlayers: 2,
      messages: [],
      scoreboard: {},
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data = { roomId, playerName };

    socket.emit('room:created', { roomId, players: [{ name: playerName, avatar: avatar || '🐱' }] });
    console.log(`🏠 Sala ${roomId} criada por ${playerName}`);
  });

  // Room joining (no gameType needed)
  socket.on('room:join', ({ roomId, playerName, avatar }: { roomId: string; playerName: string; avatar?: string }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('room:error', { message: 'Sala nao encontrada! 😢' });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit('room:error', { message: 'Sala cheia! 💔' });
      return;
    }

    room.players.push({ id: socket.id, name: playerName, avatar: avatar || '🐱' });
    socket.join(roomId);
    socket.data = { roomId, playerName };

    const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
    socket.emit('room:joined', { roomId, players: playersData });
    
    // Notify the creator that someone joined
    socket.to(roomId).emit('room:playerJoined', { 
      players: playersData,
      playerName 
    });

    console.log(`💕 ${playerName} entrou na sala ${roomId}`);
  });

  // Room state request (for page refresh / navigation)
  socket.on('room:getState', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Sala nao encontrada! 😢' });
      return;
    }
    // Re-join the socket to the room if not already in it
    socket.join(roomId);
    socket.data = { roomId, playerName: room.players.find(p => p.id === socket.id)?.name || '' };
    const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
    socket.emit('room:state', { players: playersData, gameType: room.gameType });
  });

  // ===== GAME SELECTION =====

  socket.on('room:selectGame', ({ roomId, gameType }: { roomId: string; gameType: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.gameType = gameType;
    room.state = {}; // Reset state for new game

    // Broadcast to all players in room
    io.to(roomId).emit('room:gameSelected', { gameType });
    console.log(`🎮 Jogo ${gameType} selecionado na sala ${roomId}`);
  });

  // ===== CHAT =====

  socket.on('chat:message', ({ roomId, text }: { roomId: string; text: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Find player avatar from room
    const player = room.players.find(p => p.id === socket.id);
    const msg: ChatMessage = {
      id: randomBytes(4).toString('hex'),
      sender: socket.data.playerName || 'Anonimo',
      avatar: player?.avatar || '🐱',
      text: text.slice(0, 200), // Limit message length
      time: Date.now(),
    };

    room.messages.push(msg);
    
    // Keep only last 50 messages
    if (room.messages.length > 50) {
      room.messages = room.messages.slice(-50);
    }

    io.to(roomId).emit('chat:message', msg);
  });

  socket.on('chat:getHistory', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    socket.emit('chat:history', { messages: room.messages.slice(-30) });
  });

  // ===== SCOREBOARD =====

  socket.on('scoreboard:get', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    socket.emit('scoreboard:data', { scoreboard: room.scoreboard, players: room.players.map(p => p.name) });
  });

  socket.on('scoreboard:win', ({ roomId, gameType, winnerName }: { roomId: string; gameType: string; winnerName: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (!room.scoreboard[winnerName]) {
      room.scoreboard[winnerName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, total: 0 };
    }
    if (room.scoreboard[winnerName][gameType as keyof typeof room.scoreboard[string]] !== undefined) {
      (room.scoreboard[winnerName] as any)[gameType]++;
    }
    room.scoreboard[winnerName].total++;
    io.to(roomId).emit('scoreboard:update', { scoreboard: room.scoreboard });
  });

  // ===== GAME: JOIN =====

  socket.on('game:join', ({ roomId, gameType, playerName }: { roomId: string; gameType: string; playerName: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    switch (gameType) {
      case 'tictactoe':
        socket.emit('game:assigned', {
          symbol: playerIndex === 0 ? 'X' : 'O',
          players: {
            X: room.players[0]?.name || '',
            O: room.players[1]?.name || '',
          },
        });
        if (room.players.length === 2) {
          io.to(roomId).emit('game:start');
        }
        break;

      case 'hangman':
        socket.emit('game:assigned', {
          role: playerIndex === 0 ? 'chooser' : 'guesser',
          players: {
            chooser: room.players[0]?.name || '',
            guesser: room.players[1]?.name || '',
          },
        });
        break;

      case 'memory':
        socket.emit('game:assigned', {
          playerIndex,
          players: room.players.map(p => p.name),
        });
        if (room.players.length === 2) {
          initMemoryGame(room);
        }
        break;

      case 'words':
        socket.emit('game:assigned', {
          playerIndex,
          players: room.players.map(p => p.name),
        });
        if (room.players.length === 2) {
          startWordRound(room);
        }
        break;
    }
  });

  // ===== TICTACTOE =====

  socket.on('game:move', ({ roomId, board, index, symbol }: any) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.state.board = board;
    const nextTurn = symbol === 'X' ? 'O' : 'X';
    room.state.currentTurn = nextTurn;
    io.to(roomId).emit('game:move', { board, currentTurn: nextTurn });
  });

  socket.on('game:win', ({ roomId, winner, line }: any) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (!room.state.scores) room.state.scores = { X: 0, O: 0, draws: 0 };
    room.state.scores[winner]++;
    io.to(roomId).emit('game:win', { winner, line, scores: room.state.scores });
    // Update room scoreboard
    const winnerIndex = winner === 'X' ? 0 : 1;
    const winnerName = room.players[winnerIndex]?.name;
    if (winnerName && room.scoreboard) {
      if (!room.scoreboard[winnerName]) room.scoreboard[winnerName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, total: 0 };
      room.scoreboard[winnerName].tictactoe++;
      room.scoreboard[winnerName].total++;
      io.to(roomId).emit('scoreboard:update', { scoreboard: room.scoreboard });
    }
  });

  socket.on('game:draw', ({ roomId }: any) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (!room.state.scores) room.state.scores = { X: 0, O: 0, draws: 0 };
    room.state.scores.draws++;
    io.to(roomId).emit('game:draw', { scores: room.state.scores });
  });

  socket.on('game:reset', ({ roomId }: any) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.state.board = Array(9).fill(null);
    room.state.currentTurn = 'X';
    io.to(roomId).emit('game:reset', { board: room.state.board, currentTurn: room.state.currentTurn });
  });

  // ===== HANGMAN =====

  socket.on('hangman:word', ({ roomId, word }: { roomId: string; word: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.state.word = word;
    room.state.guessedLetters = [];
    room.state.wrongGuesses = 0;
    io.to(roomId).emit('hangman:start', { word, hint: 'Adivinhe a palavra! 💕' });
  });

  socket.on('hangman:guess', ({ roomId, letter }: { roomId: string; letter: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const isCorrect = room.state.word.includes(letter);
    if (!room.state.guessedLetters) room.state.guessedLetters = [];
    room.state.guessedLetters.push(letter);
    if (!isCorrect) room.state.wrongGuesses = (room.state.wrongGuesses || 0) + 1;
    io.to(roomId).emit('hangman:guess', { letter, isCorrect });
    const wordLetters = [...new Set((room.state.word as string).split(''))];
    const allGuessed = wordLetters.every((l: string) => (room.state.guessedLetters as string[]).includes(l));
    if (allGuessed) {
      io.to(roomId).emit('hangman:win');
      // Guesser wins - update scoreboard (player 2 is guesser)
      const guesserName = room.players[1]?.name;
      if (guesserName && room.scoreboard) {
        if (!room.scoreboard[guesserName]) room.scoreboard[guesserName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, total: 0 };
        room.scoreboard[guesserName].hangman++;
        room.scoreboard[guesserName].total++;
        io.to(roomId).emit('scoreboard:update', { scoreboard: room.scoreboard });
      }
    }
    else if (room.state.wrongGuesses >= 6) io.to(roomId).emit('hangman:lose', { word: room.state.word });
  });

  socket.on('hangman:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.state.word = '';
    room.state.guessedLetters = [];
    room.state.wrongGuesses = 0;
    io.to(roomId).emit('hangman:reset');
  });

  // ===== MEMORY =====

  socket.on('memory:flip', ({ roomId, cardIndex }: { roomId: string; cardIndex: number }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.cards) return;
    const card = room.state.cards[cardIndex];
    if (!card || card.isFlipped || card.isMatched) return;
    card.isFlipped = true;
    const flippedCards = room.state.cards
      .map((c: any, i: number) => ({ ...c, index: i }))
      .filter((c: any) => c.isFlipped && !c.isMatched);
    io.to(roomId).emit('memory:flip', { cardIndex, card: { ...card } });
    if (flippedCards.length === 2) {
      const [c1, c2] = flippedCards;
      if (c1.emoji === c2.emoji) {
        c1.isMatched = true;
        c2.isMatched = true;
        if (!room.state.memoryScores) room.state.memoryScores = { player1: 0, player2: 0 };
        room.state.memoryScores[`player${(room.state.memoryCurrentTurn || 0) + 1}`]++;
        io.to(roomId).emit('memory:match', { card1: (c1 as any).index, card2: (c2 as any).index, scores: room.state.memoryScores, currentTurn: room.state.memoryCurrentTurn });
        const allMatched = room.state.cards.every((c: any) => c.isMatched);
        if (allMatched) {
          io.to(roomId).emit('memory:gameOver', { scores: room.state.memoryScores });
          // Update scoreboard for memory winner
          const memScores = room.state.memoryScores;
          const memWinner = memScores.player1 > memScores.player2 ? 0 : memScores.player2 > memScores.player1 ? 1 : -1;
          if (memWinner >= 0) {
            const memWinnerName = room.players[memWinner]?.name;
            if (memWinnerName && room.scoreboard) {
              if (!room.scoreboard[memWinnerName]) room.scoreboard[memWinnerName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, total: 0 };
              room.scoreboard[memWinnerName].memory++;
              room.scoreboard[memWinnerName].total++;
              io.to(roomId).emit('scoreboard:update', { scoreboard: room.scoreboard });
            }
          }
        }
      } else {
        const nextTurn = (room.state.memoryCurrentTurn || 0) === 0 ? 1 : 0;
        room.state.memoryCurrentTurn = nextTurn;
        io.to(roomId).emit('memory:noMatch', { card1: (c1 as any).index, card2: (c2 as any).index, currentTurn: nextTurn });
      }
    }
  });

  socket.on('memory:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    initMemoryGame(room);
  });

  // ===== WORDS =====

  socket.on('words:submit', ({ roomId, word }: { roomId: string; word: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state) return;
    if (!room.state.submittedWords) room.state.submittedWords = {};
    room.state.submittedWords[socket.id] = word;
    socket.to(roomId).emit('words:submitted', { playerIndex: room.players.findIndex(p => p.id === socket.id) });
    if (Object.keys(room.state.submittedWords).length === 2) evaluateWordRound(room);
  });

  socket.on('words:timeUp', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state) return;
    if (!room.state.submittedWords) room.state.submittedWords = {};
    if (!room.state.submittedWords[socket.id]) room.state.submittedWords[socket.id] = '';
    if (Object.keys(room.state.submittedWords).length === 2) evaluateWordRound(room);
  });

  socket.on('words:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.state.wordScores = { player1: 0, player2: 0 };
    room.state.round = 0;
    startWordRound(room);
  });

  // ===== DISCONNECT =====

  socket.on('disconnect', () => {
    console.log(`💔 Desconectou: ${socket.id}`);
    for (const [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const playerName = room.players[playerIndex].name;
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('game:playerLeft', { playerName });
        if (room.players.length === 0) rooms.delete(roomId);
      }
    }
  });
});

function initMemoryGame(room: Room) {
  const shuffledEmojis = [...LOVE_EMOJIS].sort(() => Math.random() - 0.5).slice(0, 8);
  const cards = [...shuffledEmojis, ...shuffledEmojis]
    .sort(() => Math.random() - 0.5)
    .map((emoji, index) => ({ id: index, emoji, isFlipped: false, isMatched: false }));
  room.state.cards = cards;
  room.state.memoryCurrentTurn = 0;
  room.state.memoryScores = { player1: 0, player2: 0 };
  io.to(room.id).emit('memory:start', { cards, currentTurn: 0 });
}

function startWordRound(room: Room) {
  if (room.players.length < 2) return;
  room.state.round = (room.state.round || 0) + 1;
  room.state.submittedWords = {};
  const category = WORD_CATEGORIES[Math.floor(Math.random() * WORD_CATEGORIES.length)];
  const word = category.words[Math.floor(Math.random() * category.words.length)];
  room.state.currentWord = word;
  room.state.currentCategory = category.name;
  io.to(room.id).emit('words:start', { word, category: category.name, timeLimit: 30, round: room.state.round });
}

function evaluateWordRound(room: Room) {
  if (!room.state.submittedWords || !room.state.currentWord) return;
  const targetWord = room.state.currentWord.toLowerCase();
  const playerIds = room.players.map(p => p.id);
  const results = playerIds.map((id, index) => ({
    player: room.players[index].name,
    correct: (room.state.submittedWords[id] || '').toLowerCase() === targetWord,
    word: room.state.submittedWords[id] || '',
  }));
  results.forEach((result, index) => {
    if (result.correct) {
      room.state.wordScores[`player${index + 1}`] += 10;
      room.state.wordScores[`player${index + 1}`] += 5;
    }
  });
  io.to(room.id).emit('words:roundResult', {
    results,
    scores: room.state.wordScores,
    roundWords: { player1: room.state.submittedWords[playerIds[0]] || '', player2: room.state.submittedWords[playerIds[1]] || '' },
  });
  if (room.state.round >= 5) {
    setTimeout(() => {
      const wordsWinner = room.state.wordScores.player1 > room.state.wordScores.player2 ? room.players[0].name : room.players[1].name;
      io.to(room.id).emit('words:gameOver', {
        scores: room.state.wordScores,
        winner: wordsWinner,
      });
      // Update scoreboard for words winner
      if (wordsWinner && room.scoreboard) {
        if (!room.scoreboard[wordsWinner]) room.scoreboard[wordsWinner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, total: 0 };
        room.scoreboard[wordsWinner].words++;
        room.scoreboard[wordsWinner].total++;
        io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
      }
    }, 3000);
  } else {
    setTimeout(() => startWordRound(room), 4000);
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`💕 Love Games Server rodando na porta ${PORT}`);
});
