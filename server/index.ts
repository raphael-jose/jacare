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
  scoreboard: { [playerName: string]: { tictactoe: number; hangman: number; memory: number; words: number; termo: number; snake: number; runner: number; dodgeball: number; kitchen: number; total: number } };
}

// Game rooms storage
const rooms = new Map<string, Room>();

// Grace period for disconnections (10 seconds)
const GRACE_PERIOD_MS = 10000;
const disconnectedPlayers = new Map<string, { roomId: string; playerName: string; avatar: string; timer: NodeJS.Timeout }>();

function generateRoomCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

// Uppercase, remove accents and any non A-Z characters.
function normalizeLetters(s: string): string {
  return (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');
}

// Phase of the hangman round derived from server state.
function hangmanPhase(room: Room): 'setup' | 'playing' | 'won' | 'lost' {
  if (!room.state.word) return 'setup';
  const wordLetters = [...new Set((room.state.word as string).split(''))];
  const guessed = (room.state.guessedLetters as string[]) || [];
  if (wordLetters.every((l: string) => guessed.includes(l))) return 'won';
  if ((room.state.wrongGuesses || 0) >= 6) return 'lost';
  return 'playing';
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

const MEMORY_ICONS = ['heart', 'star', 'music', 'gift', 'cake', 'flower', 'moon', 'sun'];

// Chat message
interface ChatMessage {
  id: string;
  sender: string;
  avatar: string;
  text: string;
  time: number;
}

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
        if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
          if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
          if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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

    room.players.push({ id: socket.id, name: playerName, avatar: avatar || '🐱' });
    const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
    socket.emit('room:created', { roomId, players: playersData });
    console.log(`🏠 Sala ${roomId} criada por ${playerName}`);
  });

  socket.on('room:join', ({ roomId, playerName, avatar }: { roomId: string; playerName: string; avatar?: string }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('room:error', { message: 'Sala nao encontrada!' });
      return;
    }

    socket.join(roomId);
    socket.data = { roomId, playerName };

    const disconnectKey = `${roomId}:${playerName}`;
    const graceEntry = disconnectedPlayers.get(disconnectKey);
    if (graceEntry) {
      clearTimeout(graceEntry.timer);
      disconnectedPlayers.delete(disconnectKey);
      const idx = room.players.findIndex(p => p.name === playerName);
      if (idx >= 0) {
        room.players[idx].id = socket.id;
        room.players[idx].avatar = avatar || room.players[idx].avatar;
      }
      const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
      socket.emit('room:joined', { roomId, players: playersData });
      // FIX: notify ALL players in room (including host) about reconnection
      io.to(roomId).emit('room:playerJoined', { players: playersData, playerName });
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
    // FIX: io.to notifies ALL in room, including host
    io.to(roomId).emit('room:playerJoined', { players: playersData, playerName });
    console.log(`💕 ${playerName} entrou na sala ${roomId}`);
  });

  // Room state request (for page refresh / navigation)
  socket.on('room:getState', ({ roomId, playerName, avatar }: { roomId: string; playerName?: string; avatar?: string }) => {
    const pName = playerName || '';
    const pAvatar = avatar || '🐱';
    console.log(`📋 getState: '${pName}' pediu estado da sala ${roomId} (socket: ${socket.id})`);

    const room = rooms.get(roomId);
    if (!room) {
      console.log(`❌ Sala ${roomId} nao encontrada`);
      socket.emit('room:error', { message: 'Sala nao encontrada!' });
      return;
    }

    socket.join(roomId);
    socket.data = { roomId, playerName: pName };

    // 1) Cancel any grace period for this player
    const disconnectKey = `${roomId}:${pName}`;
    const graceEntry = disconnectedPlayers.get(disconnectKey);
    if (graceEntry) {
      clearTimeout(graceEntry.timer);
      disconnectedPlayers.delete(disconnectKey);
      console.log(`🔄 ${pName} cancelou grace period`);
    }

    // 2) Is this socket already in the room?
    const existingIdx = room.players.findIndex(p => p.id === socket.id);
    if (existingIdx >= 0) {
      room.players[existingIdx].name = pName || room.players[existingIdx].name;
      room.players[existingIdx].avatar = pAvatar;
      const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
      socket.emit('room:state', { players: playersData, gameType: room.gameType });
      console.log(`📋 ${pName} ja esta na sala (${room.players.length} jogadores)`);
      return;
    }

    // 3) Not in room by socket.id — check by name (reconnection)
    const nameIdx = room.players.findIndex(p => p.name === pName);
    if (nameIdx >= 0) {
      room.players[nameIdx].id = socket.id;
      room.players[nameIdx].avatar = pAvatar;
      const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
      socket.emit('room:state', { players: playersData, gameType: room.gameType });
      // FIX: use io.to so the host also gets updated player list on reconnect
      io.to(roomId).emit('room:playerJoined', { players: playersData, playerName: pName });
      console.log(`🔄 ${pName} reconectou por nome`);
      return;
    }

    // 4) New player — add to room if there's space
    if (pName && room.players.length < room.maxPlayers) {
      room.players.push({ id: socket.id, name: pName, avatar: pAvatar });
      const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
      socket.emit('room:state', { players: playersData, gameType: room.gameType });
      // FIX: use io.to instead of socket.to so the HOST receives room:playerJoined too
      io.to(roomId).emit('room:playerJoined', { players: playersData, playerName: pName });
      console.log(`✅ ${pName} ENTROU na sala ${roomId} (${room.players.length} jogadores)`);
      return;
    }

    // 5) Room full or no name — just return current state
    const playersData = room.players.map(p => ({ name: p.name, avatar: p.avatar }));
    socket.emit('room:state', { players: playersData, gameType: room.gameType });
    console.log(`📋 ${pName} sala cheia ou sem nome (${room.players.length}/${room.maxPlayers})`);
  });

  // ===== GAME SELECTION =====

  socket.on('room:selectGame', ({ roomId, gameType }: { roomId: string; gameType: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Only the host (creator, player[0]) can pick a game
    const creator = room.players[0];
    if (!creator || creator.id !== socket.id) return;

    room.gameType = gameType;
    room.state = {};

    io.to(roomId).emit('room:gameSelected', { gameType });
    console.log(`🎮 Jogo ${gameType} selecionado na sala ${roomId}`);
  });

  socket.on('room:backToRoom', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (room) {
      // Clear the current game so Room.tsx doesn't auto-redirect back into it
      room.gameType = null;
      room.state = {};
    }
    // Notify EVERYONE in the room so both players return to the game selector
    io.to(roomId).emit('room:backToRoom');
  });

  // ===== CHAT =====

  socket.on('chat:message', ({ roomId, text }: { roomId: string; text: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    const msg: ChatMessage = {
      id: randomBytes(4).toString('hex'),
      sender: socket.data.playerName || 'Anonimo',
      avatar: player?.avatar || '🐱',
      text: text.slice(0, 200),
      time: Date.now(),
    };

    room.messages.push(msg);
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
      room.scoreboard[winnerName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
        // Sync current board/turn/scores so a refresh or reconnect doesn't
        // leave the player with a blank board while the partner is mid-game.
        socket.emit('game:sync', {
          board: room.state.board || Array(9).fill(null),
          currentTurn: room.state.currentTurn || 'X',
          scores: room.state.scores || { X: 0, O: 0, draws: 0 },
        });
        break;

      case 'hangman':
        socket.emit('game:assigned', {
          role: playerIndex === 0 ? 'chooser' : 'guesser',
          players: {
            chooser: room.players[0]?.name || '',
            guesser: room.players[1]?.name || '',
          },
        });
        // Refresh / reconnect mid-round: replay the current state so the
        // game doesn't silently reset for both players.
        if (room.state.word) {
          socket.emit('hangman:state', {
            word: room.state.word,
            guessedLetters: room.state.guessedLetters || [],
            wrongGuesses: room.state.wrongGuesses || 0,
            phase: hangmanPhase(room),
          });
        }
        break;

      case 'memory':
        socket.emit('game:assigned', {
          playerIndex,
          players: room.players.map(p => p.name),
        });
        // Boot exactly once when both are in; replay current state on rejoin
        // (refresh / reconnect) so the game doesn't silently restart.
        if (!room.state.memJoined) room.state.memJoined = [];
        if (!room.state.memJoined.includes(socket.id)) room.state.memJoined.push(socket.id);
        const memAllJoined = room.players.length >= 2 && room.players.every((p: any) => room.state.memJoined.includes(p.id));
        if (memAllJoined) {
          if (!room.state.memBooted) {
            room.state.memBooted = true;
            initMemoryGame(room);
          } else if (room.state.cards) {
            socket.emit('memory:start', {
              cards: room.state.cards,
              currentTurn: room.state.memoryCurrentTurn || 0,
              scores: room.state.memoryScores || { player1: 0, player2: 0 },
              gameOver: room.state.memoryGameOver || false,
            });
          }
        }
        break;

      case 'words':
        socket.emit('game:assigned', {
          playerIndex,
          players: room.players.map(p => p.name),
        });
        // Boot exactly once when both players have joined; replay current
        // state to sockets that rejoin later (refresh / reconnect).
        if (!room.state.wsJoined) room.state.wsJoined = [];
        if (!room.state.wsJoined.includes(socket.id)) room.state.wsJoined.push(socket.id);
        const wsAllJoined = room.players.length >= 2 && room.players.every((p: any) => room.state.wsJoined.includes(p.id));
        if (wsAllJoined) {
          if (!room.state.wsBooted) {
            room.state.wsBooted = true;
            room.state.wsScores = { player1: 0, player2: 0 };
            room.state.wsLevel = 1;
            initWordSearch(room, 1);
          } else if (room.state.wsGrid) {
            socket.emit('wordsearch:start', {
              grid: room.state.wsGrid,
              size: room.state.wsSize || 10,
              level: room.state.wsLevel || 1,
              totalLevels: room.state.wsTotalLevels || WS_TOTAL_LEVELS,
              words: room.state.wsWords,
              scores: room.state.wsScores || { player1: 0, player2: 0 },
              currentTurn: room.state.wsTurn || 0,
            });
          }
        }
        break;

      case 'termo':
        socket.emit('game:assigned', {
          playerIndex,
          players: room.players.map(p => p.name),
        });
        // Both players are already in the room roster, so the two game:join
        // events would each boot the game. Boot exactly ONCE; on later joins
        // (refresh / reconnect) replay the current state instead.
        if (!room.state.termoJoined) room.state.termoJoined = [];
        if (!room.state.termoJoined.includes(socket.id)) room.state.termoJoined.push(socket.id);
        const allJoined = room.players.length >= 2 && room.players.every((p: any) => room.state.termoJoined.includes(p.id));
        if (allJoined) {
          if (!room.state.termoBooted) {
            room.state.termoBooted = true;
            initTermoRound(room);
          } else {
            termoRejoin(room, socket, playerIndex);
          }
        }
        break;
    }
  });

  // ===== TICTACTOE =====

  socket.on('game:move', ({ roomId, board, index, symbol }: any) => {
    const room = rooms.get(roomId);
    if (!room || !Array.isArray(board) || board.length !== 9) return;
    // Server-side validation: the player must move with their own symbol,
    // on their turn, into an empty cell. Prevents desync/double-move races.
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    const expected = idx === 0 ? 'X' : 'O';
    if (symbol !== expected) return;
    if ((room.state.currentTurn || 'X') !== symbol) return;
    const prev = room.state.board || Array(9).fill(null);
    if (prev[index] !== null) return;
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
    const winnerIndex = winner === 'X' ? 0 : 1;
    const winnerName = room.players[winnerIndex]?.name;
    if (winnerName && room.scoreboard) {
      if (!room.scoreboard[winnerName]) room.scoreboard[winnerName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
    // Only the chooser (player[0]) may submit a word, and only between rounds
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx !== 0 || hangmanPhase(room) !== 'setup') return;
    // Normalize: remove accents and non-letters so the A-Z keyboard can
    // always solve the word (accented words used to deadlock the game).
    const clean = normalizeLetters(word);
    if (clean.length < 2 || clean.length > 20) return;
    room.state.word = clean;
    room.state.guessedLetters = [];
    room.state.wrongGuesses = 0;
    io.to(roomId).emit('hangman:start', { word: clean, hint: 'Adivinhe a palavra!' });
  });

  socket.on('hangman:guess', ({ roomId, letter }: { roomId: string; letter: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.word || hangmanPhase(room) !== 'playing') return;
    const l = (letter || '').toUpperCase();
    if (!/^[A-Z]$/.test(l)) return;
    if (!room.state.guessedLetters) room.state.guessedLetters = [];
    if (room.state.guessedLetters.includes(l)) return; // no double counting
    const isCorrect = room.state.word.includes(l);
    room.state.guessedLetters.push(l);
    if (!isCorrect) room.state.wrongGuesses = (room.state.wrongGuesses || 0) + 1;
    io.to(roomId).emit('hangman:guess', { letter: l, isCorrect });
    const wordLetters = [...new Set((room.state.word as string).split(''))];
    const allGuessed = wordLetters.every((x: string) => (room.state.guessedLetters as string[]).includes(x));
    if (allGuessed) {
      io.to(roomId).emit('hangman:win');
      const guesserName = room.players[1]?.name;
      if (guesserName && room.scoreboard) {
        if (!room.scoreboard[guesserName]) room.scoreboard[guesserName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
    // Only the player whose turn it is may flip (server-side enforcement)
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx === -1 || idx !== (room.state.memoryCurrentTurn || 0)) return;
    const card = room.state.cards[cardIndex];
    if (!card || card.isFlipped || card.isMatched) return;
    card.isFlipped = true;
    // CRITICAL FIX: evaluate pairs by INDEX on the LIVE array. The old code
    // mapped cards to shallow copies and mutated the copies, so matched/
    // flipped state never persisted server-side -> the game froze after the
    // very first pair (no pair was ever matched or flipped back).
    const flipped = room.state.cards
      .map((c: any, i: number) => (c.isFlipped && !c.isMatched ? i : -1))
      .filter((i: number) => i !== -1);
    io.to(roomId).emit('memory:flip', { cardIndex, card: { ...card } });
    if (flipped.length === 2) {
      const i1 = flipped[0];
      const i2 = flipped[1];
      const c1 = room.state.cards[i1];
      const c2 = room.state.cards[i2];
      if (c1.emoji === c2.emoji) {
        c1.isMatched = true;
        c2.isMatched = true;
        if (!room.state.memoryScores) room.state.memoryScores = { player1: 0, player2: 0 };
        room.state.memoryScores[`player${(room.state.memoryCurrentTurn || 0) + 1}`]++;
        io.to(roomId).emit('memory:match', { card1: i1, card2: i2, scores: room.state.memoryScores, currentTurn: room.state.memoryCurrentTurn });
        const allMatched = room.state.cards.every((c: any) => c.isMatched);
        if (allMatched) {
          room.state.memoryGameOver = true;
          io.to(roomId).emit('memory:gameOver', { scores: room.state.memoryScores });
          const memScores = room.state.memoryScores;
          const memWinner = memScores.player1 > memScores.player2 ? 0 : memScores.player2 > memScores.player1 ? 1 : -1;
          if (memWinner >= 0) {
            const memWinnerName = room.players[memWinner]?.name;
            if (memWinnerName && room.scoreboard) {
              if (!room.scoreboard[memWinnerName]) room.scoreboard[memWinnerName] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
              room.scoreboard[memWinnerName].memory++;
              room.scoreboard[memWinnerName].total++;
              io.to(roomId).emit('scoreboard:update', { scoreboard: room.scoreboard });
            }
          }
        }
      } else {
        // CRITICAL FIX: flip both cards back on the SERVER too. Without this
        // the cards stayed face-up forever, so every later flip left 3+ cards
        // "flipped" and pairs were never evaluated again -> game stuck.
        c1.isFlipped = false;
        c2.isFlipped = false;
        const nextTurn = (room.state.memoryCurrentTurn || 0) === 0 ? 1 : 0;
        room.state.memoryCurrentTurn = nextTurn;
        io.to(roomId).emit('memory:noMatch', { card1: i1, card2: i2, currentTurn: nextTurn });
      }
    }
  });

  socket.on('memory:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    initMemoryGame(room);
  });

  // ===== CAÇA-PALAVRAS (word search, turn-based) =====

  socket.on('wordsearch:guess', ({ roomId, word }: { roomId: string; word: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.wsGrid || room.state.wsPaused) return;

    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx === -1 || idx !== room.state.wsTurn) return; // not your turn

    const normalized = (word || '').trim().toUpperCase();
    const foundWord = room.state.wsWords.find((w: any) => !w.found && w.text === normalized);

    if (foundWord) {
      foundWord.found = true;
      room.state.wsFoundCount++;
      if (!room.state.wsScores) room.state.wsScores = { player1: 0, player2: 0 };
      room.state.wsScores[`player${idx + 1}`] += 10;

      io.to(room.id).emit('wordsearch:found', {
        word: foundWord.text,
        cells: foundWord.cells,
        wordsFound: room.state.wsWords.filter((w: any) => w.found).map((w: any) => w.text),
        scores: room.state.wsScores,
        currentTurn: room.state.wsTurn,
      });

      if (room.state.wsFoundCount >= room.state.wsWords.length) {
        const currentLevel = room.state.wsLevel || 1;
        room.state.wsLastFinder = idx;
        // Lock input during the level transition so timers/guesses can't
        // churn turns while everyone watches the "level complete" banner.
        room.state.wsPaused = true;
        if (currentLevel < WS_TOTAL_LEVELS) {
          io.to(room.id).emit('wordsearch:levelDone', { level: currentLevel, scores: room.state.wsScores });
          const roomId = room.id;
          setTimeout(() => {
            const r = rooms.get(roomId);
            if (r && r.state.wsGrid && (r.state.wsLevel || 1) === currentLevel && r.players.length === 2) {
              initWordSearch(r, currentLevel + 1);
            }
          }, 4000);
        } else {
          wsEndWordSearch(room);
        }
      } else {
        wsNextTurn(room);
      }
    } else {
      io.to(room.id).emit('wordsearch:miss', { word: normalized, currentTurn: room.state.wsTurn });
      wsNextTurn(room);
    }
  });

  socket.on('wordsearch:pass', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.wsGrid || room.state.wsPaused) return;
    // Only the player whose turn it is may pass
    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx === -1 || idx !== room.state.wsTurn) return;
    wsNextTurn(room);
  });

  socket.on('wordsearch:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.state.wsLevel = 1;
    room.state.wsBooted = true;
    room.state.wsScores = { player1: 0, player2: 0 };
    initWordSearch(room, 1);
  });

  // ===== TERMO (Wordle) =====

  socket.on('termo:guess', ({ roomId, guess }: { roomId: string; guess: string }) => {
    const room = rooms.get(roomId);
    if (!room || !room.state.termoWord) return;

    const idx = room.players.findIndex((p: any) => p.id === socket.id);
    if (idx === -1) return;

    const key = `player${idx + 1}`;
    if (room.state.termoDone?.[key]) return;

    // TURN-BASED: only the player whose turn it is may guess
    if (idx !== room.state.termoTurn) {
      socket.emit('termo:notYourTurn', { currentTurn: room.state.termoTurn });
      return;
    }

    const g = (guess || '').trim().toUpperCase();
    if (g.length !== 5) return;

    if (!room.state.termoGuesses[key].includes(g)) {
      room.state.termoGuesses[key].push(g);
    }
    const statuses = termoEvaluate(g, room.state.termoWord);
    room.state.termoStatuses[key] = statuses;
    const solved = g === room.state.termoWord;
    const attemptNumber = room.state.termoGuesses[key].length;

    if (solved) {
      room.state.termoSolved[key] = true;
      room.state.termoScores[key] += 10;
      room.state.termoDone[key] = true;
    } else if (attemptNumber >= 6) {
      room.state.termoDone[key] = true;
    }

    // Feedback is private — only the guesser sees the letters/colors
    socket.emit('termo:guessResult', {
      guess: g,
      statuses,
      solved,
      attemptNumber,
      round: room.state.termoRound,
    });

    if (solved) {
      termoFinishRound(room, room.players[idx]?.name || null);
    } else if (room.state.termoDone.player1 && room.state.termoDone.player2) {
      termoFinishRound(room, null);
    } else {
      termoPassTurn(room);
    }
  });

  socket.on('termo:reset', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.state.termoRound = 0;
    room.state.termoScores = { player1: 0, player2: 0 };
    initTermoRound(room);
  });

  // ===== DISCONNECT =====

  socket.on('disconnect', () => {
    console.log(`💔 Desconectou: ${socket.id}`);
    for (const [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        const playerName = player.name;

        const disconnectKey = `${roomId}:${playerName}`;

        const existing = disconnectedPlayers.get(disconnectKey);
        if (existing) clearTimeout(existing.timer);

        const timer = setTimeout(() => {
          disconnectedPlayers.delete(disconnectKey);
          const currentRoom = rooms.get(roomId);
          if (!currentRoom) return;
          const idx = currentRoom.players.findIndex((p: any) => p.name === playerName);
          if (idx !== -1) {
            currentRoom.players.splice(idx, 1);
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

  // ===== SNAKE =====

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
    let nearest: any = null;
    let minDist = 60;
    for (const st of stations) {
      const d = Math.sqrt((p.x - st.x) ** 2 + (p.y - st.y) ** 2);
      if (d < minDist) { minDist = d; nearest = st; }
    }
    if (!nearest) return;
    if (nearest.type === 'fridge' && !p.carrying) {
      p.carrying = nearest.items[Math.floor(Math.random() * nearest.items.length)];
    } else if (nearest.type === 'trash') {
      p.carrying = null;
    } else if (nearest.type === 'plate' && p.carrying) {
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
  room.state.memoryGameOver = false;
  const shuffledIcons = [...MEMORY_ICONS].sort(() => Math.random() - 0.5).slice(0, 8);
  const cards = [...shuffledIcons, ...shuffledIcons]
    .sort(() => Math.random() - 0.5)
    .map((emoji, index) => ({ id: index, emoji, isFlipped: false, isMatched: false }));
  room.state.cards = cards;
  room.state.memoryCurrentTurn = 0;
  room.state.memoryScores = { player1: 0, player2: 0 };
  io.to(room.id).emit('memory:start', { cards, currentTurn: 0 });
}

const WS_LEVELS = [
  { size: 8,  count: 4, words: ['AMOR', 'BEIJO', 'DANCA', 'VELAS', 'FLORES', 'LUA'] },
  { size: 10, count: 6, words: ['AMOR', 'BEIJO', 'DANCA', 'VELAS', 'FLORES', 'CARINHO', 'ABRACO', 'SORRISO', 'NAMORO', 'ROMANCE'] },
  { size: 12, count: 8, words: ['AMOR', 'BEIJO', 'CARINHO', 'ABRACO', 'SORRISO', 'NAMORO', 'ROMANCE', 'CORACAO', 'PAIXAO', 'JUNTOS', 'CHOCOLATE', 'FELICIDADE'] },
];
const WS_TOTAL_LEVELS = WS_LEVELS.length;

function initWordSearch(room: Room, level: number = 1) {
  if (room.players.length < 2) return;

  const lvl = Math.min(Math.max(level, 1), WS_TOTAL_LEVELS);
  const cfg = WS_LEVELS[lvl - 1];
  const size = cfg.size;
  room.state.wsLevel = lvl;
  room.state.wsSize = size;
  room.state.wsTotalLevels = WS_TOTAL_LEVELS;
  if (!room.state.wsScores) room.state.wsScores = { player1: 0, player2: 0 };

  const selected = [...cfg.words].sort(() => Math.random() - 0.5).slice(0, cfg.count);
  const grid: string[] = new Array(size * size).fill('');
  const words: { text: string; cells: number[]; found: boolean }[] = [];

  const dirs = [
    { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
  ];

  for (const w of selected) {
    let placed = false;
    for (let attempt = 0; attempt < 400 && !placed; attempt++) {
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      const endRow = row + dir.dy * (w.length - 1);
      const endCol = col + dir.dx * (w.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

      const cells: number[] = [];
      let ok = true;
      for (let i = 0; i < w.length; i++) {
        const r = row + dir.dy * i;
        const c = col + dir.dx * i;
        const idx = r * size + c;
        if (grid[idx] && grid[idx] !== w[i]) { ok = false; break; }
        cells.push(idx);
      }
      if (!ok) continue;
      cells.forEach((idx, i) => { grid[idx] = w[i]; });
      words.push({ text: w, cells, found: false });
      placed = true;
    }
  }

  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) grid[i] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  }

  room.state.wsGrid = grid;
  room.state.wsWords = words;
  room.state.wsPaused = false;
  room.state.wsTurn = lvl > 1 ? (room.state.wsLastFinder === 0 ? 1 : 0) : 0;
  room.state.wsFoundCount = 0;

  io.to(room.id).emit('wordsearch:start', {
    grid,
    size,
    level: lvl,
    totalLevels: WS_TOTAL_LEVELS,
    words: words.map(w => ({ text: w.text, cells: w.cells, found: w.found })),
    scores: room.state.wsScores || { player1: 0, player2: 0 },
    currentTurn: room.state.wsTurn,
  });
}

function wsNextTurn(room: Room) {
  room.state.wsTurn = room.state.wsTurn === 0 ? 1 : 0;
  io.to(room.id).emit('wordsearch:turn', { currentTurn: room.state.wsTurn });
}

function wsEndWordSearch(room: Room) {
  const s = room.state.wsScores;
  const winner =
    s.player1 > s.player2 ? room.players[0].name :
    s.player2 > s.player1 ? room.players[1].name :
    null;
  io.to(room.id).emit('wordsearch:gameOver', { scores: s, winner });
  if (winner && room.scoreboard) {
    if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
    room.scoreboard[winner].words++;
    room.scoreboard[winner].total++;
    io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
  }
}

const TERMO_WORDS = ['AMIGO', 'BEIJO', 'PAIXA', 'FESTA', 'JOGOS', 'SONHO', 'FELIZ', 'SALAO', 'TEMPO', 'TERNO', 'LIVRO', 'PRAIA', 'BOLSA', 'FORTE', 'NOVEL', 'PLANO', 'CORPO', 'FOGUE'];

function pickTermoWord(): string {
  return TERMO_WORDS[Math.floor(Math.random() * TERMO_WORDS.length)];
}

function initTermoRound(room: Room) {
  if (room.players.length < 2) return;
  room.state.termoRound = (room.state.termoRound || 0) + 1;
  if (!room.state.termoScores) room.state.termoScores = { player1: 0, player2: 0 };
  room.state.termoWord = pickTermoWord();
  room.state.termoGuesses = { player1: [], player2: [] };
  room.state.termoStatuses = { player1: [], player2: [] };
  room.state.termoSolved = { player1: false, player2: false };
  room.state.termoDone = { player1: false, player2: false };
  // Phase flags for rejoin support
  room.state.termoResult = false;
  room.state.termoGameOver = false;
  room.state.termoFinalWinner = null;
  // Whoever starts alternates each round for fairness
  room.state.termoTurn = (room.state.termoRound - 1) % 2;
  io.to(room.id).emit('termo:roundStart', {
    round: room.state.termoRound,
    scores: room.state.termoScores,
    currentTurn: room.state.termoTurn,
  });
}

function termoEvaluate(guess: string, word: string): string[] {
  const result = new Array(5).fill('absent');
  const wordChars = word.split('');
  const guessChars = guess.split('');
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === wordChars[i]) { result[i] = 'correct'; wordChars[i] = ''; guessChars[i] = ''; }
  }
  for (let i = 0; i < 5; i++) {
    if (guessChars[i] === '') continue;
    const j = wordChars.indexOf(guessChars[i]);
    if (j >= 0) { result[i] = 'present'; wordChars[j] = ''; }
  }
  return result;
}

function termoPassTurn(room: Room) {
  room.state.termoTurn = room.state.termoTurn === 0 ? 1 : 0;
  io.to(room.id).emit('termo:turn', { currentTurn: room.state.termoTurn });
}

function termoRejoin(room: Room, socket: Socket, idx: number) {
  const key = `player${idx + 1}`;
  const round = room.state.termoRound || 1;
  const scores = room.state.termoScores || { player1: 0, player2: 0 };
  const phase = room.state.termoGameOver ? 'over' : room.state.termoResult ? 'result' : 'round';
  socket.emit('termo:rejoin', {
    round,
    scores,
    currentTurn: room.state.termoTurn ?? 0,
    phase,
    word: phase === 'round' ? undefined : room.state.termoWord,
    winnerName: phase === 'result' ? (room.state.termoResultWinner || null) : undefined,
    finalWinner: phase === 'over' ? (room.state.termoFinalWinner || null) : undefined,
    myGuesses: room.state.termoGuesses?.[key] || [],
    myStatuses: room.state.termoStatuses?.[key] || [],
    mySolved: !!room.state.termoSolved?.[key],
    myDone: !!room.state.termoDone?.[key],
  });
}

function termoFinishRound(room: Room, winnerName: string | null) {
  const scores = room.state.termoScores;
  room.state.termoResult = true;
  room.state.termoResultWinner = winnerName || null;
  io.to(room.id).emit('termo:roundEnd', {
    word: room.state.termoWord,
    winnerName,
    scores,
    round: room.state.termoRound,
  });

  const advance = () => {
    if (room.state.termoRound >= 5) {
      const s = room.state.termoScores;
      const finalWinner =
        s.player1 > s.player2 ? room.players[0]?.name || null :
        s.player2 > s.player1 ? room.players[1]?.name || null :
        null;
      room.state.termoGameOver = true;
      room.state.termoFinalWinner = finalWinner;
      io.to(room.id).emit('termo:gameOver', { scores: s, winner: finalWinner });
      if (finalWinner && room.scoreboard) {
        if (!room.scoreboard[finalWinner]) room.scoreboard[finalWinner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
        room.scoreboard[finalWinner].termo++;
        room.scoreboard[finalWinner].total++;
        io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
      }
    } else {
      initTermoRound(room);
    }
  };
  setTimeout(advance, 3500);
}

function runnerTick(room: Room) {
  const r = room.state.runner;
  if (!r) return;
  r.tick++;
  r.spawnTimer++;
  if (r.spawnTimer >= Math.max(15, 40 - Math.floor(r.tick / 50))) {
    r.spawnTimer = 0;
    const lanes = [1, 2, 3, 4, 5];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const type = Math.random() > 0.5 ? 'high' : 'low';
    r.obstacles.push({ x: 15, y: lane, type, life: 30 });
  }
  r.obstacles = r.obstacles.filter((o: any) => { o.x -= 0.5; o.life--; return o.x > -1 && o.life > 0; });
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
    p.jumping = false;
    p.slide = false;
    if (p.alive) p.score++;
  }
  const alive = r.players.filter((p: any) => p.alive);
  if (alive.length <= 1) {
    const winnerIdx = r.players.findIndex((p: any) => p.alive);
    const winner = winnerIdx >= 0 ? room.players[winnerIdx]?.name : room.players[0]?.name;
    room.state.runnerGameOver = true;
    io.to(room.id).emit('runner:gameOver', { players: r.players, winner });
    if (winner) {
      if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
      (room.scoreboard[winner] as any).runner++;
      room.scoreboard[winner].total++;
      io.to(room.id).emit('scoreboard:update', { scoreboard: room.scoreboard });
    }
    if (room.state.runnerInterval) { clearInterval(room.state.runnerInterval); room.state.runnerInterval = null; }
    return;
  }
  io.to(room.id).emit('runner:tick', { players: r.players, obstacles: r.obstacles, tick: r.tick });
}

function dodgeballTick(room: Room) {
  const db = room.state.dodgeball;
  if (!db) return;
  db.balls = db.balls.filter((b: any) => {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.x < 0 || b.x > db.arena.w || b.y < 0 || b.y > db.arena.h || b.life <= 0) return false;
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
  const alive = db.players.filter((p: any) => p.alive);
  if (alive.length <= 1) {
    const winnerIdx = db.players.findIndex((p: any) => p.alive);
    const winner = winnerIdx >= 0 ? room.players[winnerIdx]?.name : room.players[0]?.name;
    io.to(room.id).emit('dodgeball:gameOver', { players: db.players, winner });
    if (winner) {
      if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
        if (!room.scoreboard[winner]) room.scoreboard[winner] = { tictactoe: 0, hangman: 0, memory: 0, words: 0, termo: 0, snake: 0, runner: 0, dodgeball: 0, kitchen: 0, total: 0 };
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
