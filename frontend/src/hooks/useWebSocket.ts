import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config/api';

interface MessagePayload {
    content?: string;
    type?: string;
    [key: string]: unknown;
}

interface UseWebSocketReturn {
    socketRef: React.MutableRefObject<Socket | null>;
    connected: boolean;
    sendMessage: (projectId: number, message: MessagePayload) => void;
    typing: (projectId: number, userName: string) => void;
    stopTyping: (projectId: number) => void;
    reconnect: () => void;
}

export const useWebSocket = (token: string | null): UseWebSocketReturn => {
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    const connect = useCallback(() => {
        if (!token) return;

        // Disconnect existing socket if any
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        // Connect to Socket.io server with improved settings for mobile
        const newSocket = io(WS_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            timeout: 20000,
            reconnection: true,
            reconnectionAttempts: maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            forceNew: true,
        });

        newSocket.on('connect', () => {
            console.log('WebSocket connected');
            setConnected(true);
            reconnectAttempts.current = 0;
        });

        newSocket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            setConnected(false);
            
            // Auto reconnect for specific disconnect reasons
            if (reason === 'io server disconnect' || reason === 'transport close') {
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    reconnectAttempts.current++;
                    setTimeout(() => connect(), 2000 * reconnectAttempts.current);
                }
            }
        });

        newSocket.on('connect_error', (error: Error) => {
            console.error('WebSocket connection error:', error);
            setConnected(false);
        });

        // Handle visibility change for mobile (when app goes to background)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !newSocket.connected) {
                console.log('App became visible, reconnecting...');
                newSocket.connect();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        socketRef.current = newSocket;

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [token]);

    useEffect(() => {
        const cleanup = connect();

        return () => {
            if (cleanup) cleanup();
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [connect]);

    const reconnect = useCallback(() => {
        reconnectAttempts.current = 0;
        connect();
    }, [connect]);

    const sendMessage = (projectId: number, message: MessagePayload) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('send_message', { projectId, message });
        }
    };

    const typing = (projectId: number, userName: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('typing', { projectId, userName });
        }
    };

    const stopTyping = (projectId: number) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('stop_typing', { projectId });
        }
    };

    return {
        socketRef,
        connected,
        sendMessage,
        typing,
        stopTyping,
        reconnect
    };
};
