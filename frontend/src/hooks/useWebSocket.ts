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

// Check if running as installed PWA
const isStandalonePWA = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
);

export const useWebSocket = (token: string | null): UseWebSocketReturn => {
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 15; // More attempts for PWA
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastPongRef = useRef<number>(Date.now());

    const connect = useCallback(() => {
        if (!token) return;

        // Disconnect existing socket if any
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        // Clear existing heartbeat
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
        }

        console.log('[WebSocket] Connecting...', isStandalonePWA ? '(PWA mode)' : '(Web mode)');

        // Connect to Socket.io server with improved settings for PWA
        const newSocket = io(WS_URL, {
            auth: { token },
            transports: isStandalonePWA ? ['polling', 'websocket'] : ['websocket', 'polling'], // PWA: polling first for reliability
            timeout: 30000,
            reconnection: true,
            reconnectionAttempts: maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            forceNew: true,
            upgrade: true,
            rememberUpgrade: false, // Don't remember - always try fresh for PWA
        });

        newSocket.on('connect', () => {
            console.log('[WebSocket] Connected:', newSocket.id, 'transport:', newSocket.io.engine.transport.name);
            setConnected(true);
            reconnectAttempts.current = 0;
            lastPongRef.current = Date.now();

            // Start heartbeat for PWA to keep connection alive
            // More frequent for PWA to detect dead connections faster
            const heartbeatInterval = isStandalonePWA ? 15000 : 25000;
            heartbeatRef.current = setInterval(() => {
                if (newSocket.connected) {
                    // Check if we haven't received pong in a while
                    const timeSinceLastPong = Date.now() - lastPongRef.current;
                    if (timeSinceLastPong > 60000) {
                        console.log('[WebSocket] No pong received in 60s, reconnecting...');
                        newSocket.disconnect();
                        connect();
                        return;
                    }
                    newSocket.emit('ping');
                }
            }, heartbeatInterval);

            // When transport upgrades (polling -> websocket)
            newSocket.io.engine.on('upgrade', (transport: { name: string }) => {
                console.log('[WebSocket] Upgraded to:', transport.name);
            });
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[WebSocket] Disconnected:', reason);
            setConnected(false);
            
            // Clear heartbeat
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
            }
            
            // Auto reconnect for all disconnect reasons
            if (reconnectAttempts.current < maxReconnectAttempts) {
                reconnectAttempts.current++;
                // Faster reconnect for PWA
                const baseDelay = isStandalonePWA ? 500 : 1000;
                const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttempts.current), 15000);
                console.log(`[WebSocket] Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current})`);
                setTimeout(() => {
                    if (!socketRef.current?.connected) {
                        connect();
                    }
                }, delay);
            }
        });

        newSocket.on('connect_error', (error: Error) => {
            console.error('[WebSocket] Connection error:', error.message);
            setConnected(false);
        });

        newSocket.on('pong', () => {
            // Server responded to ping - connection is healthy
            lastPongRef.current = Date.now();
        });

        // Handle visibility change for PWA (when app goes to background/foreground)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[WebSocket] App became visible, checking connection...');
                if (!newSocket.connected) {
                    console.log('[WebSocket] Reconnecting...');
                    reconnectAttempts.current = 0;
                    newSocket.connect();
                } else {
                    // Send a ping to check if connection is still alive
                    newSocket.emit('ping');
                }
            }
        };

        // Handle online/offline events
        const handleOnline = () => {
            console.log('[WebSocket] Network online, reconnecting...');
            setTimeout(() => {
                if (!newSocket.connected) {
                    reconnectAttempts.current = 0;
                    newSocket.connect();
                }
            }, 500); // Small delay to let network stabilize
        };

        const handleOffline = () => {
            console.log('[WebSocket] Network offline');
            setConnected(false);
        };

        // Handle PWA-specific events from main.tsx
        const handlePWAVisible = () => {
            console.log('[WebSocket] PWA visible event received');
            if (!newSocket.connected) {
                reconnectAttempts.current = 0;
                newSocket.connect();
            }
        };

        const handlePWAOnline = () => {
            console.log('[WebSocket] PWA online event received');
            setTimeout(() => {
                if (!newSocket.connected) {
                    reconnectAttempts.current = 0;
                    newSocket.connect();
                }
            }, 500);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('pwa-visible', handlePWAVisible);
        window.addEventListener('pwa-online', handlePWAOnline);

        socketRef.current = newSocket;

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('pwa-visible', handlePWAVisible);
            window.removeEventListener('pwa-online', handlePWAOnline);
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
            }
        };
    }, [token]);

    useEffect(() => {
        const cleanup = connect();

        return () => {
            if (cleanup) cleanup();
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
            }
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
