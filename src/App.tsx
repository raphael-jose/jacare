import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import TicTacToe from './pages/TicTacToe';
import Hangman from './pages/Hangman';
import MemoryGame from './pages/MemoryGame';
import WordGame from './pages/WordGame';
import FloatingHearts from './components/FloatingHearts';

function App() {
  return (
    <div className="min-h-screen relative">
      <FloatingHearts />
      <div className="relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/game/tictactoe/:roomId" element={<TicTacToe />} />
          <Route path="/game/hangman/:roomId" element={<Hangman />} />
          <Route path="/game/memory/:roomId" element={<MemoryGame />} />
          <Route path="/game/words/:roomId" element={<WordGame />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
