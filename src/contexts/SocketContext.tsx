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
  // CRITICAL FIX: create the socket SYNCHRONOUSLY on first render.
  // React runs child useEffect() hooks BEFORE the parent's useEffect().
  // If we created the socket inside useEffect here, child pages (Room, Home)
  // would call on()/emit() while socketRef.current is still null and every
  // listener registration would silently no-op -> room join never worked for
  // guests who landed directly on the room link.
  const socketRef = useRef<Socket | null>(null);
  if (socketRef.current === null) {
    console.log('[Socket] Connecting to', SOCKET_URL);
    socketRef.current = io(SOCKET_URL, {
      transports: ['polling', 'websocket'], // polling FIRST — more reliable for cold starts
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity, // never give up
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000, // 20s per attempt
    });
  }

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

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
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
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
