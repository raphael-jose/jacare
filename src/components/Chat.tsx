import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';

interface Message {
  id: string;
  sender: string;
  avatar: string;
  text: string;
  time: number;
}

interface ChatProps {
  roomId: string;
  playerName: string;
}

export default function Chat({ roomId, playerName }: ChatProps) {
  const { emit, on } = useSocket();
  const { playMessage, playClick } = useSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Request chat history
    emit('chat:getHistory', { roomId });

    const unsub1 = on('chat:message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
      if (msg.sender !== playerName) playMessage();
      if (!isOpen) {
        setUnread(prev => prev + 1);
      }
    });

    const unsub2 = on('chat:history', (data: { messages: Message[] }) => {
      setMessages(data.messages);
    });

    return () => { unsub1(); unsub2(); };
  }, [roomId, emit, on, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = () => {
    if (!input.trim()) return;
    emit('chat:message', { roomId, text: input.trim() });
    setInput('');
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Chat toggle button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-love-400 to-love-600 
                   flex items-center justify-center shadow-lg shadow-love-300/50 text-white"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center"
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 right-6 z-50 w-80 h-96 bg-white/95 backdrop-blur-sm rounded-3xl 
                       shadow-2xl shadow-love-200/30 border-2 border-love-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-love-400 to-love-600 p-4 text-white">
              <h3 className="font-bold text-sm">💬 Chat da Sala</h3>
              <p className="text-love-100 text-xs">Mensagens em tempo real</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <div className="text-center text-love-300 text-sm py-8">
                  <p className="text-3xl mb-2">💬</p>
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-xs mt-1">Diga oi para seu amor! 💕</p>
                </div>
              )}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.sender === playerName ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className="w-7 h-7 rounded-full bg-love-100 flex items-center justify-center text-sm flex-shrink-0">
                    {msg.avatar}
                  </div>
                  <div className={`flex flex-col ${msg.sender === playerName ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-love-400 mb-0.5 px-1">
                      {msg.sender} • {formatTime(msg.time)}
                    </span>
                    <div
                      className={`max-w-[200px] px-3 py-2 rounded-2xl text-sm font-medium ${
                        msg.sender === playerName
                          ? 'bg-love-500 text-white rounded-br-md'
                          : 'bg-love-50 text-love-700 border border-love-100 rounded-bl-md'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-love-100">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-3 py-2 rounded-full bg-love-50 border border-love-200 
                           text-sm focus:outline-none focus:border-love-400 text-love-700 placeholder-love-300"
                  maxLength={200}
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="w-9 h-9 rounded-full bg-love-500 text-white flex items-center justify-center 
                           disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
