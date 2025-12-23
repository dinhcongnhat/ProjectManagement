import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, File, X, Loader2, MessageSquare, Mic, MicOff, Play, Pause, FileText, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DiscussionOnlyOfficeViewer } from './DiscussionOnlyOfficeViewer';
import { FileDownloadButton } from './ui/DownloadOptions';
import { AttachmentPicker } from './ui/AttachmentPicker';
import { io, Socket } from 'socket.io-client';
import { API_URL, WS_URL } from '../config/api';

interface Message {
    id: number;
    content: string | null;
    messageType: 'TEXT' | 'VOICE' | 'FILE' | 'IMAGE' | 'TEXT_WITH_FILE';
    attachment: string | null;
    attachmentUrl: string | null;
    createdAt: string;
    sender: {
        id: number;
        name: string;
        role: string;
    };
}

interface DiscussionPanelProps {
    projectId: number;
}

// Check if running as installed PWA
const isStandalonePWA = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
);

// Check if file is an Office document that OnlyOffice can open
const isOfficeFile = (filename: string | null): boolean => {
    if (!filename) return false;
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    // OnlyOffice Document Server supported formats
    const officeExts = [
        // Word documents
        'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt',
        // Excel spreadsheets
        'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv',
        // PowerPoint presentations
        'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp',
        // PDF and HTML
        'pdf', 'mht', 'html', 'htm'
    ];
    return officeExts.includes(ext);
};

// Check if file is an image
const isImageFile = (filename: string | null): boolean => {
    if (!filename) return false;
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
};

// Helper to resolve relative URLs to absolute URLs
const resolveAttachmentUrl = (url: string | null): string | null => {
    if (!url) return null;
    // If already absolute URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    // If relative URL, prepend API base URL (without /api suffix)
    const baseUrl = API_URL.replace('/api', '');
    return `${baseUrl}${url}`;
};

export const DiscussionPanel = ({ projectId }: DiscussionPanelProps) => {
    const { user, token } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageModal, setImageModal] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [playingAudio, setPlayingAudio] = useState<number | null>(null);
    const [showOnlyOffice, setShowOnlyOffice] = useState<{ messageId: number; fileName: string } | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const [typingUsers, setTypingUsers] = useState<{ userId: number; userName: string }[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const shouldScrollRef = useRef(true);

    const scrollToBottom = (force = false) => {
        if (force || shouldScrollRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Fetch messages initially
    const fetchMessages = useCallback(async (isManualRefresh = false) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        if (isManualRefresh) {
            setIsRefreshing(true);
        }

        try {
            const response = await fetch(`${API_URL}/projects/${projectId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache',
                },
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            setMessages(data.messages || []);
            setError(null);
            shouldScrollRef.current = true;
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error('Error fetching messages:', err);
            setError('Không thể tải tin nhắn. Vui lòng thử lại.');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [projectId, token]);

    // Setup WebSocket connection
    useEffect(() => {
        if (!token) return;

        console.log('[Discussion] Connecting WebSocket for project:', projectId);

        const socket = io(WS_URL, {
            auth: { token },
            transports: isStandalonePWA ? ['polling', 'websocket'] : ['websocket', 'polling'],
            timeout: 30000,
            reconnection: true,
            reconnectionAttempts: 15,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            forceNew: true,
        });

        socket.on('connect', () => {
            console.log('[Discussion] WebSocket connected');
            setWsConnected(true);
            // Join project room
            socket.emit('join_project', projectId.toString());

            // Start heartbeat for PWA
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            heartbeatRef.current = setInterval(() => {
                if (socket.connected) socket.emit('ping');
            }, isStandalonePWA ? 15000 : 25000);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Discussion] WebSocket disconnected:', reason);
            setWsConnected(false);
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        });

        socket.on('pong', () => {
            // Connection healthy
        });

        // Listen for new discussion messages
        socket.on('discussion:new_message', (data: { projectId: number; message: Message }) => {
            console.log('[Discussion] New message received:', data);
            if (data.projectId === projectId) {
                setMessages(prev => {
                    // Avoid duplicates
                    if (prev.some(m => m.id === data.message.id)) return prev;
                    return [...prev, data.message];
                });
                // Scroll to bottom for new messages
                setTimeout(() => scrollToBottom(true), 100);
            }
        });

        // Listen for typing indicators
        socket.on('discussion:typing', (data: { projectId: number; userId: number; userName: string }) => {
            if (data.projectId === projectId && data.userId !== user?.id) {
                setTypingUsers(prev => {
                    if (prev.some(u => u.userId === data.userId)) return prev;
                    return [...prev, { userId: data.userId, userName: data.userName }];
                });
            }
        });

        socket.on('discussion:stop_typing', (data: { projectId: number; userId: number }) => {
            if (data.projectId === projectId) {
                setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
            }
        });

        // Handle visibility change for PWA
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !socket.connected) {
                socket.connect();
            }
        };

        const handleOnline = () => {
            if (!socket.connected) socket.connect();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);
        window.addEventListener('pwa-visible', handleVisibilityChange);
        window.addEventListener('pwa-online', handleOnline);

        socketRef.current = socket;

        return () => {
            console.log('[Discussion] Cleaning up WebSocket');
            socket.emit('leave_project', projectId.toString());
            socket.disconnect();
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('pwa-visible', handleVisibilityChange);
            window.removeEventListener('pwa-online', handleOnline);
        };
    }, [token, projectId, user?.id]);

    // Initial fetch
    useEffect(() => {
        fetchMessages();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchMessages]);

    // Manual refresh handler
    const handleRefresh = () => {
        setError(null);
        fetchMessages(true);
    };

    // Emit typing indicator
    const emitTyping = useCallback(() => {
        if (socketRef.current?.connected && user) {
            socketRef.current.emit('discussion:typing', {
                projectId,
                userId: user.id,
                userName: user.name
            });

            // Clear previous timeout
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            // Stop typing after 3 seconds
            typingTimeoutRef.current = setTimeout(() => {
                socketRef.current?.emit('discussion:stop_typing', { projectId, userId: user.id });
            }, 3000);
        }
    }, [projectId, user]);

    // Handle file selection - auto send when file is selected
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        // Auto send the file immediately
        setSending(true);
        shouldScrollRef.current = true;

        try {
            const authToken = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/projects/${projectId}/messages/file`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });

            if (!response.ok) throw new Error('Failed to send file');

            const sentMessage = await response.json();
            setMessages(prev => {
                if (prev.some(m => m.id === sentMessage.id)) return prev;
                return [...prev, sentMessage];
            });
            setTimeout(() => scrollToBottom(true), 100);
        } catch (err) {
            setError('Không thể gửi file');
            console.error('Error sending file:', err);
        } finally {
            setSending(false);
        }
    };

    // Remove selected file
    const removeSelectedFile = () => {
        setSelectedFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Send text message
    const sendTextMessage = async () => {
        if (!newMessage.trim() && !selectedFile) return;

        setSending(true);
        shouldScrollRef.current = true;

        // Stop typing indicator
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socketRef.current?.emit('discussion:stop_typing', { projectId, userId: user?.id });

        try {
            const authToken = localStorage.getItem('token');

            if (selectedFile) {
                // Send file with optional text
                const formData = new FormData();
                formData.append('file', selectedFile);
                if (newMessage.trim()) {
                    formData.append('content', newMessage.trim());
                }

                const response = await fetch(`${API_URL}/projects/${projectId}/messages/file`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: formData
                });

                if (!response.ok) throw new Error('Failed to send file');

                // Get the sent message from response and add it directly
                const sentMessage = await response.json();
                setMessages(prev => {
                    if (prev.some(m => m.id === sentMessage.id)) return prev;
                    return [...prev, sentMessage];
                });
                setTimeout(() => scrollToBottom(true), 100);

                removeSelectedFile();
            } else {
                // Send text only
                const response = await fetch(`${API_URL}/projects/${projectId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: newMessage.trim() })
                });

                if (!response.ok) throw new Error('Failed to send message');

                // Get the sent message from response and add it directly
                const sentMessage = await response.json();
                setMessages(prev => {
                    if (prev.some(m => m.id === sentMessage.id)) return prev;
                    return [...prev, sentMessage];
                });
                setTimeout(() => scrollToBottom(true), 100);
            }

            setNewMessage('');
            setError(null);
        } catch (err) {
            setError('Không thể gửi tin nhắn');
            console.error('Error sending message:', err);
        } finally {
            setSending(false);
        }
    };

    // Voice recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            setError('Không thể truy cập microphone');
            console.error('Error starting recording:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const sendVoiceMessage = async () => {
        if (!audioBlob) return;

        setSending(true);
        shouldScrollRef.current = true;
        try {
            const authToken = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice-message.webm');

            const response = await fetch(`${API_URL}/projects/${projectId}/messages/voice`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });

            if (!response.ok) throw new Error('Failed to send voice message');

            // Get the sent message from response and add it directly
            const sentMessage = await response.json();
            setMessages(prev => {
                if (prev.some(m => m.id === sentMessage.id)) return prev;
                return [...prev, sentMessage];
            });
            setTimeout(() => scrollToBottom(true), 100);

            setAudioBlob(null);
            setError(null);
        } catch (err) {
            setError('Không thể gửi tin nhắn thoại');
            console.error('Error sending voice message:', err);
        } finally {
            setSending(false);
        }
    };

    const cancelVoiceMessage = () => {
        setAudioBlob(null);
    };

    // Play audio
    const toggleAudio = (messageId: number, url: string) => {
        if (playingAudio === messageId) {
            audioRef.current?.pause();
            setPlayingAudio(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            audioRef.current = new Audio(url);
            audioRef.current.onended = () => setPlayingAudio(null);
            audioRef.current.play();
            setPlayingAudio(messageId);
        }
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;

        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get file name from attachment path
    const getFileName = (attachment: string | null) => {
        if (!attachment) return 'File';
        const parts = attachment.split('/');
        const fileName = parts[parts.length - 1];
        // Remove timestamp prefix if present (format: projectId-userId-timestamp-filename)
        const match = fileName.match(/^\d+-\d+-\d+-(.+)$/);
        let name = match ? match[1] : fileName;

        // Try to decode URI encoded filename (may need multiple decodes)
        try {
            // First decode
            name = decodeURIComponent(name);
            // Check if still encoded (contains %)
            if (name.includes('%')) {
                name = decodeURIComponent(name);
            }
        } catch {
            // Keep as is if decoding fails
        }

        return name;
    };

    // Render message content based on type
    const renderMessageContent = (message: Message) => {
        const isOwnMessage = message.sender.id === user?.id;
        const attachmentUrl = resolveAttachmentUrl(message.attachmentUrl);

        switch (message.messageType) {
            case 'TEXT':
                return (
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                );

            case 'IMAGE':
                return (
                    <div className="space-y-2">
                        {attachmentUrl && (
                            <img
                                src={attachmentUrl}
                                alt="Hình ảnh"
                                className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setImageModal(attachmentUrl)}
                            />
                        )}
                    </div>
                );

            case 'FILE':
                return (
                    <div
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${isOwnMessage ? 'bg-blue-400 hover:bg-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                        onClick={() => {
                            if (isOfficeFile(message.attachment)) {
                                setShowOnlyOffice({ messageId: message.id, fileName: getFileName(message.attachment) });
                            }
                        }}
                        title={isOfficeFile(message.attachment) ? 'Nhấn để xem file' : undefined}
                    >
                        {isOfficeFile(message.attachment) ? (
                            <FileText size={20} />
                        ) : (
                            <File size={20} />
                        )}
                        <span className={`text-sm flex-1 truncate ${isOfficeFile(message.attachment) ? 'underline' : ''}`}>
                            {getFileName(message.attachment)}
                        </span>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {attachmentUrl && (
                                <FileDownloadButton
                                    fileName={getFileName(message.attachment)}
                                    downloadUrl={attachmentUrl}
                                    token={localStorage.getItem('token') || ''}
                                    isOwnMessage={isOwnMessage}
                                    size="sm"
                                />
                            )}
                        </div>
                    </div>
                );

            case 'TEXT_WITH_FILE':
                return (
                    <div className="space-y-2">
                        {message.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        )}
                        {isImageFile(message.attachment) ? (
                            attachmentUrl && (
                                <img
                                    src={attachmentUrl}
                                    alt="Hình ảnh"
                                    className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setImageModal(attachmentUrl)}
                                />
                            )
                        ) : (
                            <div
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${isOwnMessage ? 'bg-blue-400 hover:bg-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                                onClick={() => {
                                    if (isOfficeFile(message.attachment)) {
                                        setShowOnlyOffice({ messageId: message.id, fileName: getFileName(message.attachment) });
                                    }
                                }}
                                title={isOfficeFile(message.attachment) ? 'Nhấn để xem file' : undefined}
                            >
                                {isOfficeFile(message.attachment) ? (
                                    <FileText size={20} />
                                ) : (
                                    <File size={20} />
                                )}
                                <span className={`text-sm flex-1 truncate ${isOfficeFile(message.attachment) ? 'underline' : ''}`}>
                                    {getFileName(message.attachment)}
                                </span>
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    {attachmentUrl && (
                                        <FileDownloadButton
                                            fileName={getFileName(message.attachment)}
                                            downloadUrl={attachmentUrl}
                                            token={localStorage.getItem('token') || ''}
                                            isOwnMessage={isOwnMessage}
                                            size="sm"
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'VOICE':
                return (
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${isOwnMessage ? 'bg-blue-400' : 'bg-gray-100'}`}>
                        <button
                            onClick={() => attachmentUrl && toggleAudio(message.id, attachmentUrl)}
                            className="p-2 rounded-full hover:bg-gray-200"
                            title={playingAudio === message.id ? 'Tạm dừng' : 'Phát'}
                        >
                            {playingAudio === message.id ? <Pause size={20} /> : <Play size={20} />}
                        </button>
                        <span className="text-sm">Tin nhắn thoại</span>
                    </div>
                );

            default:
                return <p className="text-sm">{message.content}</p>;
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin text-blue-500" size={48} />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-180px)] sm:h-[calc(100vh-220px)] min-h-[350px] max-h-[800px] isolate overscroll-none">
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageSquare size={20} className="text-blue-500 sm:w-6 sm:h-6" />
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800">Thảo luận</h3>
                        <span className="text-xs sm:text-sm text-gray-500">({messages.length})</span>
                        {/* Connection status */}
                        <span title={wsConnected ? "Đã kết nối realtime" : "Mất kết nối"}>
                            {wsConnected ? (
                                <Wifi size={14} className="text-green-500" />
                            ) : (
                                <WifiOff size={14} className="text-red-500" />
                            )}
                        </span>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50 touch-manipulation"
                        title="Làm mới"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500 italic">
                        {typingUsers.map(u => u.userName).join(', ')} đang soạn tin...
                    </div>
                )}
            </div>

            {/* Messages - Isolated scroll container */}
            <div
                className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 overscroll-contain"
                style={{ overscrollBehaviorY: 'contain' }}
                onWheel={(e) => {
                    // Prevent parent scroll when at boundaries
                    const element = e.currentTarget;
                    const atTop = element.scrollTop === 0;
                    const atBottom = element.scrollHeight - element.scrollTop === element.clientHeight;

                    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
                        e.stopPropagation();
                    }
                }}
            >
                {messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
                        <p>Chưa có tin nhắn nào</p>
                        <p className="text-sm">Bắt đầu thảo luận ngay!</p>
                    </div>
                ) : (
                    messages.map((message) => {
                        const isOwnMessage = message.sender.id === user?.id;
                        return (
                            <div
                                key={message.id}
                                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : ''}`}>
                                    {!isOwnMessage && (
                                        <p className="text-xs text-gray-500 mb-1 ml-1">
                                            {message.sender.name}
                                            {message.sender.role === 'ADMIN' && (
                                                <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">
                                                    Admin
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    <div
                                        className={`p-3 rounded-2xl ${isOwnMessage
                                            ? 'bg-blue-500 text-white rounded-br-md'
                                            : 'bg-gray-100 text-gray-800 rounded-bl-md'
                                            }`}
                                    >
                                        {renderMessageContent(message)}
                                    </div>
                                    <p className={`text-xs text-gray-400 mt-1 ${isOwnMessage ? 'text-right mr-1' : 'ml-1'}`}>
                                        {formatDate(message.createdAt)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Error message */}
            {error && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex-shrink-0">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* File preview */}
            {selectedFile && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded" />
                        ) : (
                            <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                                <File size={24} className="text-gray-500" />
                            </div>
                        )}
                        <div className="flex-1">
                            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                            <p className="text-xs text-gray-500">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                        <button
                            onClick={removeSelectedFile}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Xóa file"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Voice recording preview */}
            {audioBlob && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Mic size={20} className="text-blue-500" />
                        <span className="text-sm text-blue-700 flex-1">Tin nhắn thoại đã ghi</span>
                        <button
                            onClick={cancelVoiceMessage}
                            className="p-1 hover:bg-blue-100 rounded text-blue-600"
                            title="Hủy ghi âm"
                        >
                            <X size={20} />
                        </button>
                        <button
                            onClick={sendVoiceMessage}
                            disabled={sending}
                            className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : 'Gửi'}
                        </button>
                    </div>
                </div>
            )}

            {/* Input area */}
            <div className="p-3 sm:p-4 border-t border-gray-100 flex-shrink-0 bg-white safe-area-bottom sticky bottom-0">
                <div className="flex items-end gap-1 sm:gap-2">
                    {/* File attachment button */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                        title="Chọn file để đính kèm"
                    />
                    <AttachmentPicker
                        token={token || ''}
                        onFilesSelected={(files) => {
                            if (files.length > 0) {
                                setSelectedFile(files[0]);
                            }
                        }}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                        multiple={false}
                        buttonClassName="p-2.5 sm:p-2 text-gray-500 hover:bg-gray-100 active:bg-gray-200 rounded-lg touch-manipulation shrink-0"
                        iconSize={22}
                    />

                    {/* Voice recording button */}
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`p-2.5 sm:p-2 rounded-lg touch-manipulation shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:bg-gray-100 active:bg-gray-200'}`}
                        title={isRecording ? 'Dừng ghi âm' : 'Ghi âm'}
                    >
                        {isRecording ? <MicOff size={22} className="sm:w-5 sm:h-5" /> : <Mic size={22} className="sm:w-5 sm:h-5" />}
                    </button>

                    {/* Text input */}
                    <div className="flex-1 min-w-0">
                        <textarea
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                emitTyping();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendTextMessage();
                                }
                            }}
                            placeholder="Nhập tin nhắn..."
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            rows={1}
                            disabled={sending || isRecording}
                            style={{ fontSize: '16px' }} // Prevent iOS zoom on focus
                        />
                    </div>

                    {/* Send button */}
                    <button
                        onClick={sendTextMessage}
                        disabled={sending || isRecording || (!newMessage.trim() && !selectedFile)}
                        className="p-2.5 sm:p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation shrink-0"
                        title="Gửi tin nhắn"
                    >
                        {sending ? <Loader2 size={22} className="animate-spin sm:w-5 sm:h-5" /> : <Send size={22} className="sm:w-5 sm:h-5" />}
                    </button>
                </div>
            </div>

            {/* Image modal */}
            {imageModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
                    onClick={() => setImageModal(null)}
                >
                    <div className="max-w-4xl max-h-[90vh] p-4">
                        <img
                            src={imageModal}
                            alt="Xem ảnh"
                            className="max-w-full max-h-full object-contain rounded-lg"
                        />
                    </div>
                    <button
                        onClick={() => setImageModal(null)}
                        className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100"
                        title="Đóng"
                    >
                        <X size={24} />
                    </button>
                </div>
            )}

            {/* OnlyOffice viewer modal for discussion attachments */}
            {showOnlyOffice && (
                <DiscussionOnlyOfficeViewer
                    messageId={showOnlyOffice.messageId}
                    fileName={showOnlyOffice.fileName}
                    onClose={() => setShowOnlyOffice(null)}
                    token={localStorage.getItem('token') || ''}
                />
            )}
        </div>
    );
};
