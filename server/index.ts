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
  pingTimeout: 30000,
  pingInterval: 10000,
});

// Types
interface Room {
  id: string;
  gameType: string | null;
  players: { id: string; name: string; avatar: string }[];
  state: any;
  maxPlayers: number;
  messages: { id: string; sender: string; text: string; time: number }[];
  scoreboard: { [playerName: string]: { tictactoe: number; hangman: number; memory: number; words: number; snake: number; runner: number; dodgeball: number; kitchen: number; total: number } };
}

// Game rooms storage
const rooms = new Map<string, Room>();

// Grace period for disconnections (10 seconds)
const GRACE_PERIOD_MS = 10000;
const disconnectedPlayers = new Map<string, { roomId: string; playerName: string; avatar: string; timer: NodeJS.Timeout }>();

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
// ===== SNAKE CONSTANTS & FUNCTIONS =====

const SNAKE_GRID = { w: 20, h: 20 };
const SNAKE_TICK = 150;
const SNAKE_TARGET = 15;

function initSnakeGame(room: Room) {
  room.state.snakes = [
    { dir: 'right', body: [{x: 3, y: 5}, {x: 2, y: 5}, {x: 1, y: 5}], color: 'love' },
    { dir: 'right', body: [{x: 3, y: 14}, {x: 2, y: 14}, {x: 1, y: 14}], color: 'purple' },
  ];
  room.state.snakeFood = { x: Math.floor(Math.random() * SNAKE_GRID.w), y: Math.floor(Math.random() * SNAKE_GRID.h) };
  room.state.snakeScores = [0, 0];
  room.state.snakeGameOver = false;
  io.to(room.id).emit('snake:start', { snakes: room.state.snakes, food: room.state.snakeFood, grid: SNAKE_GRID, target: SNAKE_TARGET });
}

function snakeTick(room: Room) {
  if (room.state.snakeGameOver) return;
  const snakes = room.state.snakes;
  if (!snakes) return;
  for (let i = 0; i < snakes.length; i++) {
    const s = snakes[i];
    const head = { ...s.body[0] };
    if (s.dir === 'right') head.x++;
    else if (s.dir === 'left') head.x--;
    else if (s.dir === 'up') head.y--;
    else if (s.dir === 'down') head.y++;
    head.x = (head.x + SNAKE_GRID.w) % SNAKE_GRID.w;
    head.y = (head.y + SNAKE_GRID.h) % SNAKE_GRID.h;
    if (s.body.some((p: any) => p.x === head.x && p.y === head.y)) {
      room.state.snakeGameOver = true;
      const winner = i === 0 ? room.players[1]?.name : room.players[0]?.name;
      io.to(room.id).emit('snake:gameOver', { winner, scores: room.state.snakeScores });
      if (winner) {
        if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
        (room.scoreboard[winner] as any).snake++;
        room.scoreboard[winner].total++;
        io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
      }
      return;
    }
    for (let j = 0; j < snakes.length; j++) {
      if (i === j) continue;
      if (snakes[j].body.some((p: any) => p.x === head.x && p.y === head.y)) {
        room.state.snakeGameOver = true;
        const winner = j === 0 ? room.players[1]?.name : room.players[0]?.name;
        io.to(room.id).emit('snake:gameOver', { winner, scores: room.state.snakeScores });
        if (winner) {
          if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
          (room.scoreboard[winner] as any).snake++;
          room.scoreboard[winner].total++;
          io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
        }
        return;
      }
    }
    s.body.unshift(head);
    const food = room.state.snakeFood;
    if (head.x === food.x && head.y === food.y) {
      room.state.snakeScores[i]++;
      if (room.state.snakeScores[i] >= SNAKE_TARGET) {
        room.state.snakeGameOver = true;
        const winner = room.players[i]?.name;
        io.to(room.id).emit('snake:gameOver', { winner, scores: room.state.snakeScores });
        if (winner) {
          if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
          (room.scoreboard[winner] as any).snake++;
          room.scoreboard[winner].total++;
          io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
        }
        return;
      }
      room.state.snakeFood = { x: Math.floor(Math.random() * SNAKE_GRID.w), y: Math.floor(Math.random() * SNAKE_GRID.h) };
    } else {
      s.body.pop();
    }
  }
  io.to(room.id).emit('snake:tick', { snakes: room.state.snakes, food: room.state.snakeFood, scores: room.state.snakeScores });
}

io.on('connection', (socket: Socket) => {
  console.log(`✨ Conectou: ${socket.id}`);

  // ===== ROOM MANAGEMENT =====

  // Room creation (no gameType needed)
  socket.on('room:create', ({ playerName, avatar }: { playerName: string; avatar: string }) => {
    const roomId = generateRoomCode();
    const room: Room = {
      id: roomId,
      gameType: null,
      players: [],
      state: {},
      maxPlayers: 2,
      messages: [],
      scoreboard: {},
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data = { roomId, playerName };

    // Now immediately join via room:join logic
    room.players.push({ id: socket.id, name: playerName, avatar: avatar || '🐱' });
    const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
    socket.emit('room:created', { roomId, players: playersData });
    console.log(`🏠 Sala ${roomId} criada por ${playerName}`);
  });

  // Room joining (no gameType needed)
  socket.on('room:join', ({ roomId, playerName, avatar }: { roomId: string; playerName: string; avatar?: string }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('room:error', { message: 'Sala nao encontrada!' });
      return;
    }

    socket.join(roomId);
    socket.data = { roomId, playerName };

    // Check grace period first — reconnecting player
    const disconnectKey = `${roomId}:${playerName}`;
    const graceEntry = disconnectedPlayers.get(disconnectKey);
    if (graceEntry) {
      clearTimeout(graceEntry.timer);
      disconnectedPlayers.delete(disconnectKey);
      // Update existing player entry with new socket.id
      const idx = room.players.findIndex(p => p.name === playerName);
      if (idx >= 0) {
        room.players[idx].id = socket.id;
        room.players[idx].avatar = avatar || room.players[idx].avatar;
      }
      const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
      socket.emit('room:joined', { roomId, players: playersData });
      console.log(`🔄 ${playerName} reconectou na sala ${roomId}`);
      return;
    }

    const existingIdx = room.players.findIndex(p => p.id === socket.id);
    if (existingIdx >= 0) {
      room.players[existingIdx].name = playerName;
      room.players[existingIdx].avatar = avatar || room.players[existingIdx].avatar;
      const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
      socket.emit('room:joined', { roomId, players: playersData });
      return;
    }

    // Check by name for reconnection
    const nameIdx = room.players.findIndex(p => p.name === playerName);
    if (nameIdx >= 0) {
      room.players[nameIdx].id = socket.id;
      room.players[nameIdx].avatar = avatar || room.players[nameIdx].avatar;
      const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
      socket.emit('room:joined', { roomId, players: playersData });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit('room:error', { message: 'Sala cheia!' });
      return;
    }

    room.players.push({ id: socket.id, name: playerName, avatar: avatar || 'cat' });

    const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
    socket.emit('room:joined', { roomId, players: playersData });
    socket.to(roomId).emit("room:playerJoined", { players: playersData, playerName });
    console.log(playerName + " entrou na sala " + roomId);

    console.log(`💕 ${playerName} entrou na sala ${roomId}`);
  });

  // Room state request (for page refresh / navigation)
  socket.on('room:getState', ({ roomId, playerName, avatar }: { roomId: string; playerName?: string; avatar?: string }) => {
    console.log(`📋 getState: ${playerName} pediu estado da sala ${roomId}`);
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`❌ Sala ${roomId} nao encontrada`);
      socket.emit('room:error', { message: 'Sala nao encontrada! 😢' });
      return;
    }
    socket.join(roomId);
    socket.data = { roomId, playerName: playerName || '' };

    const pName = playerName || '';
    const pAvatar = avatar || '🐱';
    let didJoin = false;

    // Check grace period first
    const disconnectKey = `${roomId}:${pName}`;
    const graceEntry = disconnectedPlayers.get(disconnectKey);
    if (graceEntry) {
      clearTimeout(graceEntry.timer);
      disconnectedPlayers.delete(disconnectKey);
      const idx = room.players.findIndex(p => p.name === pName);
      if (idx >= 0) {
        room.players[idx].id = socket.id;
        room.players[idx].avatar = pAvatar;
      }
      console.log(`🔄 ${pName} reconectou via getState`);
    }

    // Check if this socket is already in the room
    const existingIdx = room.players.findIndex(p => p.id === socket.id);
    if (existingIdx >= 0) {
      if (pName) room.players[existingIdx].name = pName;
      if (avatar) room.players[existingIdx].avatar = pAvatar;
    } else {
      const nameIdx = room.players.findIndex(p => p.name === pName);
      if (nameIdx >= 0) {
        room.players[nameIdx].id = socket.id;
        room.players[nameIdx].avatar = pAvatar;
      } else if (pName && room.players.length < room.maxPlayers) {
        room.players.push({ id: socket.id, name: pName, avatar: pAvatar });
        didJoin = true;
      }
    }

    const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
    socket.emit('room:state', { players: playersData, gameType: room.gameType });

    console.log(`📋 getState: sala ${roomId} tem ${room.players.length} jogadores, didJoin=${didJoin}`);
    if (didJoin) {
      console.log(`✅ ${pName} entrou na sala ${roomId} via getState`);
      socket.to(roomId).emit('room:playerJoined', { players: playersData, playerName: pName });
    }
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

  // Player goes back to room (switch game)
  socket.on('room:backToRoom', ({ roomId }: { roomId: string }) => {
    socket.to(roomId).emit('room:backToRoom');
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
      room.scoreboard[winnerName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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

    const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
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
      if (!room.scoreboard[winnerName]) room.scoreboard[winnerName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
    if (!room || !room.state.word) return;
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
        if (!room.scoreboard[guesserName]) room.scoreboard[guesserName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
              if (!room.scoreboard[memWinnerName]) room.scoreboard[memWinnerName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
    socket.to(roomId).emit('words:submitted', { playerIndex: room.players.findIndex((p: any) => p.id === socket.id) });
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
      const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        const playerName = player.name;

        // Don't remove immediately — start a grace period for reconnection
        const disconnectKey = `${roomId}:${playerName}`;

        // Cancel any existing grace period for this player
        const existing = disconnectedPlayers.get(disconnectKey);
        if (existing) clearTimeout(existing.timer);

        const timer = setTimeout(() => {
          // Grace period expired — actually remove the player
          disconnectedPlayers.delete(disconnectKey);
          const currentRoom = rooms.get(roomId);
          if (!currentRoom) return;
          const idx = currentRoom.players.findIndex((p: any) => p.name === playerName);
          if (idx !== -1) {
            currentRoom.players.splice(idx, 1);
            // Clear game intervals
            if (currentRoom.state.snakeInterval) { clearInterval(currentRoom.state.snakeInterval); currentRoom.state.snakeInterval = null; }
            if (currentRoom.state.runnerInterval) { clearInterval(currentRoom.state.runnerInterval); currentRoom.state.runnerInterval = null; }
            if (currentRoom.state.dodgeballInterval) { clearInterval(currentRoom.state.dodgeballInterval); currentRoom.state.dodgeballInterval = null; }
            io.to(roomId).emit('game:playerLeft', { playerName });
            if (currentRoom.players.length === 0) rooms.delete(roomId);
          }
        }, GRACE_PERIOD_MS);

        disconnectedPlayers.set(disconnectKey, {
          roomId,
          playerName,
          avatar: player.avatar,
          timer,
        });

        console.log(`⏳ ${playerName} em periodo de grace (${GRACE_PERIOD_MS / 1000}s)`);
      }
    }
  });

  // ===== SHARED MUSIC CONTROL =====

  const musicEvents = ['music:play', 'music:pause', 'music:next', 'music:prev', 'music:mute', 'music:unmute'];
  for (const event of musicEvents) {
    socket.on(event, ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit(event);
    });
  }
  socket.on('music:volume', ({ roomId, volume }: { roomId: string; volume: number }) => {
    socket.to(roomId).emit('music:volume', { volume });
  });

  // ===== NEW GAMES =====

  socket.on('snake:join', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    socket.join(roomId);
    socket.data = { ...socket.data, roomId };
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (room.players.length === 2 && !room.state.snakeInterval) {
      initSnakeGame(room);
      room.state.snakeInterval = setInterval(() => snakeTick(room), SNAKE_TICK);
    } else if (idx >= 0) {
      socket.emit('snake:start', { snakes: room.state.snakes, food: room.state.snakeFood, grid: SNAKE_GRID, target: SNAKE_TARGET });
    }
  });

  socket.on('snake:dir', ({ roomId, dir }: { roomId: string; dir: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.snakes) return;
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx >= 0 && room.state.snakes[idx]) {
      const s = room.state.snakes[idx];
      const opposites: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' };
      if (opposites[dir] !== s.dir) s.dir = dir;
    }
  });

  socket.on('snake:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.state.snakeInterval) clearInterval(room.state.snakeInterval);
    room.state.snakeInterval = null;
    initSnakeGame(room);
  });

  // ===== COMPETITIVE RUNNER =====

  socket.on('runner:join', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    socket.join(roomId);
    socket.data = { ...socket.data, roomId };
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (!room.state.runner) {
      room.state.runner = {
        players: room.players.map(() => ({ y: 3, alive: true, score: 0, jumping: false, slide: false })),
        obstacles: [],
        tick: 0,
        speed: 3,
        spawnTimer: 0,
      };
    }
    socket.emit('runner:start', { players: room.state.runner.players, grid: { w: 15, h: 7 } });
    if (room.players.length === 2 && !room.state.runnerInterval) {
      room.state.runnerInterval = setInterval(() => runnerTick(room), 100);
    }
  });

  socket.on('runner:action', ({ roomId, action }: { roomId: string; action: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.runner) return;
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx < 0 || !room.state.runner.players[idx]) return;
    const p = room.state.runner.players[idx];
    if (!p.alive) return;
    if (action === 'jump') p.jumping = true;
    else if (action === 'slide') p.slide = true;
  });

  socket.on('runner:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.state.runnerInterval) clearInterval(room.state.runnerInterval);
    room.state.runnerInterval = null;
    room.state.runner = null;
  });

  // ===== DODGEBALL =====

  socket.on('dodgeball:join', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    socket.join(roomId);
    socket.data = { ...socket.data, roomId };
    if (!room.state.dodgeball) {
      const arena = { w: 400, h: 300 };
      room.state.dodgeball = {
        players: room.players.map((p, i) => ({
          x: i === 0 ? 100 : 300, y: 150,
          hp: 3, alive: true, dir: 'down',
        })),
        balls: [],
        arena,
      };
    }
    socket.emit('dodgeball:start', room.state.dodgeball);
    if (room.players.length === 2 && !room.state.dodgeballInterval) {
      room.state.dodgeballInterval = setInterval(() => dodgeballTick(room), 50);
    }
  });

  socket.on('dodgeball:move', ({ roomId, dx, dy }: { roomId: string; dx: number; dy: number }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.dodgeball) return;
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx < 0) return;
    const p = room.state.dodgeball.players[idx];
    if (!p || !p.alive) return;
    const speed = 4;
    p.x = Math.max(15, Math.min(room.state.dodgeball.arena.w - 15, p.x + dx * speed));
    p.y = Math.max(15, Math.min(room.state.dodgeball.arena.h - 15, p.y + dy * speed));
    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
      else p.dir = dy > 0 ? 'down' : 'up';
    }
  });

  socket.on('dodgeball:throw', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.dodgeball) return;
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx < 0) return;
    const p = room.state.dodgeball.players[idx];
    if (!p || !p.alive) return;
    const speed = 6;
    let vx = 0, vy = 0;
    if (p.dir === 'right') vx = speed;
    else if (p.dir === 'left') vx = -speed;
    else if (p.dir === 'down') vy = speed;
    else if (p.dir === 'up') vy = -speed;
    room.state.dodgeball.balls.push({ x: p.x, y: p.y, vx, vy, owner: idx, life: 120 });
  });

  socket.on('dodgeball:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.state.dodgeballInterval) clearInterval(room.state.dodgeballInterval);
    room.state.dodgeballInterval = null;
    room.state.dodgeball = null;
  });

  // ===== CHAOTIC KITCHEN =====

  socket.on('kitchen:join', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    socket.join(roomId);
    socket.data = { ...socket.data, roomId };
    if (!room.state.kitchen) {
      room.state.kitchen = {
        orders: [] as any[],
        score: 0,
        timeLeft: 90,
        players: room.players.map((_, i) => ({
          x: i === 0 ? 80 : 320, y: 200,
          carrying: null as string | null,
        })),
        stations: [
          { id: 'fridge', x: 50, y: 50, type: 'fridge', items: ['massa', 'arroz', 'pao', 'alface', 'tomate', 'carne', 'peixe', 'queijo', 'creme', 'fruta', 'molho'] },
          { id: 'board1', x: 150, y: 50, type: 'board', accepts: ['massa', 'arroz', 'pao', 'alface'] },
          { id: 'stove', x: 250, y: 50, type: 'stove', accepts: ['assar', 'enrolar'] },
          { id: 'plate', x: 350, y: 50, type: 'plate' },
          { id: 'trash', x: 350, y: 250, type: 'trash' },
        ],
        currentOrderIdx: 0,
      };
      spawnKitchenOrder(room);
      room.state.kitchenInterval = setInterval(() => kitchenTick(room), 1000);
      room.state.kitchenMoveInterval = setInterval(() => {
        io.to(room.id).emit('kitchen:state', {
          orders: room.state.kitchen.orders,
          players: room.state.kitchen.players,
          score: room.state.kitchen.score,
          timeLeft: room.state.kitchen.timeLeft,
        });
      }, 100);
    }
    socket.emit('kitchen:start', {
      orders: room.state.kitchen.orders,
      stations: room.state.kitchen.stations,
      players: room.state.kitchen.players,
      score: room.state.kitchen.score,
      timeLeft: room.state.kitchen.timeLeft,
    });
  });

  socket.on('kitchen:move', ({ roomId, dx, dy }: { roomId: string; dx: number; dy: number }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.kitchen) return;
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx < 0) return;
    const p = room.state.kitchen.players[idx];
    if (!p) return;
    p.x = Math.max(20, Math.min(380, p.x + dx * 3));
    p.y = Math.max(20, Math.min(280, p.y + dy * 3));
  });

  socket.on('kitchen:interact', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.kitchen) return;
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx < 0) return;
    const p = room.state.kitchen.players[idx];
    if (!p) return;
    const stations = room.state.kitchen.stations;
    // Find nearest station
    let nearest: any = null;
    let minDist = 60;
    for (const st of stations) {
      const d = Math.sqrt((p.x - st.x) ** 2 + (p.y - st.y) ** 2);
      if (d < minDist) { minDist = d; nearest = st; }
    }
    if (!nearest) return;
    // Interaction logic
    if (nearest.type === 'fridge' && !p.carrying) {
      p.carrying = nearest.items[Math.floor(Math.random() * nearest.items.length)];
    } else if (nearest.type === 'trash') {
      p.carrying = null;
    } else if (nearest.type === 'plate' && p.carrying) {
      // Check if matches order
      const order = room.state.kitchen.orders[0];
      if (order && p.carrying === order.name) {
        room.state.kitchen.score += 10;
        room.state.kitchen.orders.shift();
        spawnKitchenOrder(room);
        p.carrying = null;
      }
    }
  });

  socket.on('kitchen:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.state.kitchenInterval) clearInterval(room.state.kitchenInterval);
    if (room.state.kitchenMoveInterval) clearInterval(room.state.kitchenMoveInterval);
    room.state.kitchenInterval = null;
    room.state.kitchenMoveInterval = null;
    room.state.kitchen = null;
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
  if (!room.state.wordScores) room.state.wordScores = { player1: 0, player2: 0 };
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
      if (wordsWinner && room.scoreboard) {
        if (!room.scoreboard[wordsWinner]) room.scoreboard[wordsWinner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
        room.scoreboard[wordsWinner].words++;
        room.scoreboard[wordsWinner].total++;
        io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
      }
    }, 3000);
  } else {
    setTimeout(() => startWordRound(room), 4000);
  }
}

function runnerTick(room: Room) {
  const r = room.state.runner;
  if (!r) return;
  r.tick++;
  // Spawn obstacles
  r.spawnTimer++;
  if (r.spawnTimer >= Math.max(15, 40 - Math.floor(r.tick / 50))) {
    r.spawnTimer = 0;
    const lanes = [1, 2, 3, 4, 5];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const type = Math.random() > 0.5 ? 'high' : 'low';
    r.obstacles.push({ x: 15, y: lane, type, life: 30 });
  }
  // Move obstacles
  r.obstacles = r.obstacles.filter((o: any) => { o.x -= 0.5; o.life--; return o.x > -1 && o.life > 0; });
  // Check collisions
  for (let i = 0; i < r.players.length; i++) {
    const p = r.players[i];
    if (!p.alive) continue;
    for (const o of r.obstacles) {
      if (Math.abs(o.x - 1) < 0.8 && o.y === p.y) {
        if (o.type === 'low' && p.slide) { /* dodged */ }
        else if (o.type === 'low' && !p.slide) { p.alive = false; }
        if (o.type === 'high' && p.jumping) { /* dodged */ }
        else if (o.type === 'high' && !p.jumping) { p.alive = false; }
      }
    }
    // Reset jump/slide after collision check
    p.jumping = false;
    p.slide = false;
    if (p.alive) p.score++;
  }
  // Check game over
  const alive = r.players.filter((p: any) => p.alive);
  if (alive.length <= 1) {
    const winnerIdx = r.players.findIndex((p: any) => p.alive);
    const winner = winnerIdx >= 0 ? room.players[winnerIdx]?.name : room.players[0]?.name;
    room.state.runnerGameOver = true;
    io.to(room.id).emit('runner:gameOver', { players: r.players, winner });
    if (winner) {
      if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
      (room.scoreboard[winner] as any).runner++;
      room.scoreboard[winner].total++;
      io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
    }
    if (room.state.runnerInterval) { clearInterval(room.state.runnerInterval); room.state.runnerInterval = null; }
    return;
  }
  // Move player position for scrolling effect
  io.to(room.id).emit('runner:tick', { players: r.players, obstacles: r.obstacles, tick: r.tick });
}

function dodgeballTick(room: Room) {
  const db = room.state.dodgeball;
  if (!db) return;
  // Move balls
  db.balls = db.balls.filter((b: any) => {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.x < 0 || b.x > db.arena.w || b.y < 0 || b.y > db.arena.h || b.life <= 0) return false;
    // Check hit
    for (let i = 0; i < db.players.length; i++) {
      if (i === b.owner) continue;
      const p = db.players[i];
      if (!p.alive) continue;
      const d = Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2);
      if (d < 18) {
        p.hp--;
        if (p.hp <= 0) p.alive = false;
        return false;
      }
    }
    return true;
  });
  // Check game over
  const alive = db.players.filter((p: any) => p.alive);
  if (alive.length <= 1) {
    const winnerIdx = db.players.findIndex((p: any) => p.alive);
    const winner = winnerIdx >= 0 ? room.players[winnerIdx]?.name : room.players[0]?.name;
    io.to(room.id).emit('dodgeball:gameOver', { players: db.players, winner });
    if (winner) {
      if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
      (room.scoreboard[winner] as any).dodgeball++;
      room.scoreboard[winner].total++;
      io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
    }
    if (room.state.dodgeballInterval) { clearInterval(room.state.dodgeballInterval); room.state.dodgeballInterval = null; }
    return;
  }
  io.to(room.id).emit('dodgeball:tick', { players: db.players, balls: db.balls });
}

const KITCHEN_RECIPES = [
  { name: 'Pizza', emoji: '🍕', steps: ['massa', 'molho', 'queijo', 'assar'] },
  { name: 'Sushi', emoji: '🍣', steps: ['arroz', 'peixe', 'enrolar'] },
  { name: 'Hamburguer', emoji: '🍔', steps: ['pao', 'carne', 'alface', 'pao'] },
  { name: 'Bolo', emoji: '🎂', steps: ['massa', 'creme', 'fruta'] },
  { name: 'Salada', emoji: '🥗', steps: ['alface', 'tomate', 'molho'] },
];

function spawnKitchenOrder(room: Room) {
  if (!room.state.kitchen) return;
  const recipe = KITCHEN_RECIPES[Math.floor(Math.random() * KITCHEN_RECIPES.length)];
  room.state.kitchen.orders.push({ ...recipe, timeLeft: 30 });
}

function kitchenTick(room: Room) {
  const k = room.state.kitchen;
  if (!k) return;
  k.timeLeft--;
  // Order timers
  for (const o of k.orders) {
    o.timeLeft--;
    if (o.timeLeft <= 0) {
      k.score = Math.max(0, k.score - 5);
      k.orders.splice(k.orders.indexOf(o), 1);
      spawnKitchenOrder(room);
      break;
    }
  }
  if (k.timeLeft <= 0) {
    io.to(room.id).emit('kitchen:gameOver', { score: k.score });
    if (k.score > 0) {
      const winner = room.players[0]?.name;
      if (winner) {
        if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
        (room.scoreboard[winner] as any).kitchen++;
        room.scoreboard[winner].total++;
        io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
      }
    }
    if (room.state.kitchenInterval) { clearInterval(room.state.kitchenInterval); room.state.kitchenInterval = null; }
    if (room.state.kitchenMoveInterval) { clearInterval(room.state.kitchenMoveInterval); room.state.kitchenMoveInterval = null; }
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`💕 Love Games Server rodando na porta ${PORT}`);
});
