import { useEffect, useRef, useState} from 'react';
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
}

export const useWebSocket = (token: string | null): UseWebSocketReturn => {
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!token) return;

        // Connect to Socket.io server
        const newSocket = io(WS_URL, {
            auth: { token }
        });

        newSocket.on('connect', () => {
            console.log('WebSocket connected');
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            setConnected(false);
        });

        newSocket.on('connect_error', (error: Error) => {
            console.error('WebSocket connection error:', error);
            setConnected(false);
        });

        socketRef.current = newSocket;

        return () => {
            newSocket.disconnect();
            socketRef.current = null;
        };
    }, [token]);

    const sendMessage = (projectId: number, message: MessagePayload) => {
        if (socketRef.current) {
            socketRef.current.emit('send_message', { projectId, message });
        }
    };

    const typing = (projectId: number, userName: string) => {
        if (socketRef.current) {
            socketRef.current.emit('typing', { projectId, userName });
        }
    };

    const stopTyping = (projectId: number) => {
        if (socketRef.current) {
            socketRef.current.emit('stop_typing', { projectId });
        }
    };

    return {
        socketRef,
        connected,
        sendMessage,
        typing,
        stopTyping
    };
};
