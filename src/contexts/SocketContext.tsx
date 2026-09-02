import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://jacare-jp86.onrender.com');

interface SocketContextType {
  socket: React.MutableRefObject<Socket | null>;
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  isConnected: () => boolean;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    console.log('[Socket] Connecting to', SOCKET_URL);
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],  // polling FIRST — more reliable for cold starts
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,       // never give up
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,                        // 20s per attempt
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected!', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.log('[Socket] Connection error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event: string, ...args: any[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    socketRef.current?.on(event, callback);
    return () => {
      socketRef.current?.off(event, callback);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef, emit, on, isConnected: () => socketRef.current?.connected ?? false, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
}
