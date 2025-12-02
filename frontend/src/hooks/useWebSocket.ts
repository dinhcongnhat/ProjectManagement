import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketReturn {
    socket: Socket | null;
    connected: boolean;
    sendMessage: (projectId: number, message: any) => void;
    typing: (projectId: number, userName: string) => void;
    stopTyping: (projectId: number) => void;
}

export const useWebSocket = (token: string | null): UseWebSocketReturn => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!token) return;

        // Connect to Socket.io server
        const newSocket = io('http://localhost:3000', {
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

        newSocket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            setConnected(false);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [token]);

    const sendMessage = (projectId: number, message: any) => {
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
        socket,
        connected,
        sendMessage,
        typing,
        stopTyping
    };
};
