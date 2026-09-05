import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Smile, Mic, Square, Image as ImageIcon, Film } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSounds } from '../hooks/useSounds';
import AvatarBadge from './AvatarBadge';
import { showError } from '../utils/alert';

interface Message {
  id: string;
  sender: string;
  avatar: string;
  kind: 'text' | 'audio' | 'image' | 'gif';
  text?: string;
  data?: string;
  time: number;
}

interface ChatProps {
  roomId: string;
  playerName: string;
}

const EMOJIS = [
  '😍', '🥰', '😘', '💋', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '🌹', '💐',
  '😊', '😉', '🥺', '😅', '😂', '🤭', '😳', '🤗', '😎', '😴', '🥳', '🤩',
  '😇', '🙈', '🙉', '🐱', '🐶', '🦋', '🌸', '✨', '⭐', '🌙', '☀️', '🍓',
  '🍫', '🍕', '☕', '🎁', '🎉', '🎊', '🏆', '👑', '💍', '💎', '🚀', '🔥',
  '👀', '💪', '🤝', '🫶', '👫', '💏', '💑', '😴', '😝', '😤', '😭', '😡',
];

// Giphy is OPTIONAL: without VITE_GIPHY_KEY the chat shows a curated set of
// couple GIFs (pixel art, shipped with the app) — no external API needed.
const GIPHY_KEY = import.meta.env.VITE_GIPHY_KEY || '';
const HAS_GIPHY = !!GIPHY_KEY;
const GIF_BASE = import.meta.env.BASE_URL || '/';
const CURATED_GIFS = [
  { label: 'Coração', url: `${GIF_BASE}gifs/heart.gif` },
  { label: 'Dois corações', url: `${GIF_BASE}gifs/hearts2.gif` },
  { label: 'Beijo', url: `${GIF_BASE}gifs/kiss.gif` },
  { label: 'Abraço', url: `${GIF_BASE}gifs/hug.gif` },
  { label: 'Brilhando', url: `${GIF_BASE}gifs/sparkle.gif` },
  { label: 'Cartinha', url: `${GIF_BASE}gifs/letter.gif` },
];

export default function Chat({ roomId, playerName }: ChatProps) {
  const { emit, on } = useSocket();
  const { playMessage, playClick } = useSounds();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- emoji / gif panels ---
  const [showEmojis, setShowEmojis] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<{ url: string; preview: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState(false);

  // --- voice recording ---
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    emit('chat:getHistory', { roomId });

    const unsub1 = on('chat:message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
      if (msg.sender !== playerName) playMessage();
      if (!isOpen) setUnread(prev => prev + 1);
    });

    const unsub2 = on('chat:history', (data: { messages: Message[] }) => {
      setMessages((data.messages || []).map(m => ({ ...m, kind: m.kind || 'text' })));
    });

    return () => { unsub1(); unsub2(); };
  }, [roomId, emit, on, isOpen, playerName, playMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setShowEmojis(false);
      setShowGifs(false);
    }
  }, [isOpen]);

  useEffect(() => () => { stopRecording(); }, []);

  const sendMessage = () => {
    if (!input.trim()) return;
    emit('chat:message', { roomId, kind: 'text', text: input.trim() });
    setInput('');
    setShowEmojis(false);
  };

  const sendMedia = (kind: 'image' | 'gif' | 'audio', data: string) => {
    emit('chat:message', { roomId, kind, data });
    setShowGifs(false);
    setGifQuery('');
    setGifResults([]);
  };

  // --- emoji picker ---
  const addEmoji = (e: string) => {
    setInput(prev => prev + e);
    inputRef.current?.focus();
  };

  // --- image upload (compress before sending) ---
  const onImagePicked = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = MAX / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { sendMedia('image', reader.result as string); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl.length > 8 * 1024 * 1024) {
          showError('Imagem grande demais! Envie uma foto menor.');
          return;
        }
        sendMedia('image', dataUrl);
      };
      img.onerror = () => sendMedia('image', reader.result as string);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // --- giphy search (only when a key is configured) ---
  const searchGifs = async (q: string) => {
    const query = q.trim();
    if (!query || !GIPHY_KEY) return;
    setGifLoading(true);
    setGifError(false);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(query)}&limit=12&rating=g`
      );
      if (!res.ok) throw new Error('giphy error');
      const json = await res.json();
      const items = (json.data || []).map((g: any) => ({
        url: g.images?.original?.url || g.images?.fixed_height?.url || '',
        preview: g.images?.fixed_height?.url || g.images?.preview_gif?.url || '',
      })).filter((i: any) => i.url);
      setGifResults(items);
      if (items.length === 0) setGifError(true);
    } catch {
      setGifError(true);
    } finally {
      setGifLoading(false);
    }
  };

  // --- voice recording ---
  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recChunksRef.current, { type });
        const reader = new FileReader();
        reader.onload = () => sendMedia('audio', reader.result as string);
        reader.readAsDataURL(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecTime(0);
      recTimerRef.current = setInterval(() => {
        setRecTime(t => {
          if (t >= 59) { stopRecording(); return 0; }
          return t + 1;
        });
      }, 1000);
      playClick();
    } catch {
      showError('Não consegui acessar o microfone. Verifique a permissão do navegador!');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    setRecording(false);
    setRecTime(0);
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderBubble = (msg: Message) => {
    const mine = msg.sender === playerName;
    const bubbleClass = mine
      ? 'bg-love-500 text-white rounded-br-md'
      : 'bg-love-50 text-love-700 border border-love-100 rounded-bl-md';

    let content: ReactNode;
    if (msg.kind === 'image' || msg.kind === 'gif') {
      content = (
        <img
          src={msg.data}
          alt="mídia"
          className="max-w-[220px] max-h-64 rounded-2xl object-cover"
          loading="lazy"
        />
      );
    } else if (msg.kind === 'audio') {
      content = (
        <audio controls preload="none" className="w-52 h-10" src={msg.data}>
          Seu navegador não suporta áudio
        </audio>
      );
    } else {
      content = <p className="break-words whitespace-pre-wrap">{msg.text}</p>;
    }

    return (
      <div className={`max-w-[230px] px-3 py-2 rounded-2xl text-sm font-medium ${bubbleClass}`}>
        {content}
      </div>
    );
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
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <MessageCircle size={15} /> Chat da Sala
              </h3>
              <p className="text-love-100 text-xs">Emojis, voz, fotos e GIFs 💌</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <div className="text-center text-love-300 text-sm py-8">
                  <MessageCircle size={34} className="mx-auto mb-2" />
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-xs mt-1">Diga oi para seu amor!</p>
                </div>
              )}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.sender === playerName ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <AvatarBadge avatar={msg.avatar} name={msg.sender} size={28} />
                  <div className={`flex flex-col ${msg.sender === playerName ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-love-400 mb-0.5 px-1">
                      {msg.sender} • {formatTime(msg.time)}
                    </span>
                    {renderBubble(msg)}
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Emoji picker */}
            <AnimatePresence>
              {showEmojis && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-love-100 overflow-y-auto max-h-36 bg-love-50/60"
                >
                  <div className="grid grid-cols-8 gap-1 p-2">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => addEmoji(e)}
                        className="text-xl hover:scale-125 transition-transform"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* GIF picker */}
            <AnimatePresence>
              {showGifs && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-love-100 bg-white"
                >
                  {HAS_GIPHY ? (
                    <>
                      <div className="flex gap-2 p-2">
                        <input
                          value={gifQuery}
                          onChange={(e) => setGifQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && searchGifs(gifQuery)}
                          placeholder="Buscar GIF (ex: beijo, amor)"
                          className="flex-1 px-3 py-1.5 rounded-full bg-love-50 border border-love-200 text-sm focus:outline-none focus:border-love-400 text-love-700 placeholder-love-300"
                          maxLength={60}
                        />
                        <button
                          onClick={() => searchGifs(gifQuery)}
                          disabled={gifLoading || !gifQuery.trim()}
                          className="px-3 py-1 rounded-full bg-love-500 text-white text-xs font-bold disabled:opacity-40"
                        >
                          Buscar
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 p-2 overflow-y-auto max-h-40">
                        {gifLoading && (
                          <div className="col-span-3 text-center text-love-400 text-xs py-4">Buscando GIFs...</div>
                        )}
                        {gifError && !gifLoading && (
                          <div className="col-span-3 text-center text-love-400 text-xs py-4">
                            Nenhum GIF encontrado. Tente outra busca!
                          </div>
                        )}
                        {gifResults.map((g, i) => (
                          <img
                            key={i}
                            src={g.preview}
                            alt="gif"
                            loading="lazy"
                            onClick={() => sendMedia('gif', g.url)}
                            className="w-full h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 border border-love-100"
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="p-2">
                      <p className="text-[10px] font-bold text-love-400 mb-1.5 px-1">GIFs fofos pra mandar</p>
                      <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-44">
                        {CURATED_GIFS.map((g) => (
                          <button
                            key={g.label}
                            onClick={() => sendMedia('gif', g.url)}
                            className="flex flex-col items-center gap-0.5"
                          >
                            <img
                              src={g.url}
                              alt={g.label}
                              loading="lazy"
                              className="w-full h-16 object-cover rounded-lg border border-love-100 hover:opacity-80"
                            />
                            <span className="text-[9px] text-love-400 font-medium">{g.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="p-3 border-t border-love-100">
              {recording ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-red-50 border border-red-200">
                  <span className="text-red-500 font-bold text-sm animate-pulse flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    Gravando... {String(Math.floor(recTime / 60)).padStart(2, '0')}:{String(recTime % 60).padStart(2, '0')}
                  </span>
                  <button onClick={stopRecording} className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center">
                    <Square size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5 items-center">
                  <button
                    onClick={() => { setShowGifs(false); setShowEmojis(!showEmojis); }}
                    title="Emojis"
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showEmojis ? 'bg-love-500 text-white' : 'bg-love-50 text-love-600'}`}
                  >
                    <Smile size={16} />
                  </button>
                  <button
                    onClick={() => { setShowEmojis(false); setShowGifs(!showGifs); }}
                    title="GIFs"
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showGifs ? 'bg-love-500 text-white' : 'bg-love-50 text-love-600'}`}
                  >
                    <Film size={16} />
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    title="Enviar foto"
                    className="w-8 h-8 rounded-full bg-love-50 text-love-600 flex items-center justify-center"
                  >
                    <ImageIcon size={16} />
                  </button>
                  <button
                    onClick={startRecording}
                    title="Mensagem de voz"
                    className="w-8 h-8 rounded-full bg-love-50 text-love-600 flex items-center justify-center"
                  >
                    <Mic size={16} />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-full bg-love-50 border border-love-200 
                             text-sm focus:outline-none focus:border-love-400 text-love-700 placeholder-love-300"
                    maxLength={500}
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="w-9 h-9 rounded-full bg-love-500 text-white flex items-center justify-center 
                             disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send size={16} />
                  </motion.button>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImagePicked(f);
                e.target.value = '';
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}