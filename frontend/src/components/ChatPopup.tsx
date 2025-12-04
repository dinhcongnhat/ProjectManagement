import React, { useState, useEffect, useRef } from 'react';
import {
    MessageCircle, X, Search, Users, MessageSquare, Send, Smile, Paperclip,
    Mic, MicOff, Minimize2, Maximize2, ArrowLeft, Play, Pause,
    Volume2, FileText, Download, Eye, Plus, Check, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { DiscussionOnlyOfficeViewer } from './DiscussionOnlyOfficeViewer';
import { useWebSocket } from '../hooks/useWebSocket';

// ==================== TYPES ====================
interface User {
    id: number;
    name: string;
    username: string;
    avatar?: string;
    avatarUrl?: string;
    email?: string;
}

interface ConversationMember {
    id: number;
    userId: number;
    conversationId: number;
    role: 'ADMIN' | 'MEMBER';
    user: User;
}

interface Message {
    id: number;
    content: string | null;
    messageType: 'TEXT' | 'VOICE' | 'FILE' | 'IMAGE' | 'TEXT_WITH_FILE';
    attachment: string | null;
    attachmentUrl: string | null;
    attachmentName?: string | null;
    createdAt: string;
    sender: {
        id: number;
        name: string;
        avatar?: string;
    };
}

interface Conversation {
    id: number;
    type: 'PRIVATE' | 'GROUP';
    name: string | null;
    members: ConversationMember[];
    lastMessage: Message | null;
    unreadCount: number;
    displayName: string;
    displayAvatar: string | null;
    updatedAt: string;
}

interface ChatWindow {
    id: number;
    conversationId: number;
    conversation: Conversation;
    isMinimized: boolean;
    isMaximized: boolean;
    messages: Message[];
    unread: number;
}

// ==================== UTILITIES ====================
const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '🎉', '👏', '🙏', '💪'];

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatMessageTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const isOfficeFile = (filename: string | null): boolean => {
    if (!filename) return false;
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'csv', 'txt'].includes(ext);
};

const extractFilename = (path: string): string => {
    if (!path) return 'file';
    const parts = path.split('/');
    return parts[parts.length - 1] || 'file';
};

const getFileIconColor = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const colors: Record<string, string> = {
        doc: 'bg-blue-500', docx: 'bg-blue-500',
        xls: 'bg-green-500', xlsx: 'bg-green-500',
        ppt: 'bg-orange-500', pptx: 'bg-orange-500',
        pdf: 'bg-red-500',
        default: 'bg-gray-500'
    };
    return colors[ext] || colors.default;
};

// ==================== MAIN COMPONENT ====================
const ChatPopup: React.FC = () => {
    const { user, token } = useAuth();
    const { socketRef, connected } = useWebSocket(token);
    
    // Panel state
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [searchMode, setSearchMode] = useState<'conversations' | 'users'>('conversations');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Data state
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [searchUsers, setSearchUsers] = useState<User[]>([]);
    const [chatWindows, setChatWindows] = useState<ChatWindow[]>([]);
    const [mobileActiveChat, setMobileActiveChat] = useState<ChatWindow | null>(null);
    
    // Input state
    const [messageInputs, setMessageInputs] = useState<Record<number, string>>({});
    const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
    
    // Typing state
    const [typingUsers, setTypingUsers] = useState<Record<number, { userName: string; userId: number }[]>>({});
    const typingTimeoutRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
    
    // Recording state
    const [isRecording, setIsRecording] = useState<number | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    
    // Playback state
    const [playingAudio, setPlayingAudio] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    // File viewer state
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [showOnlyOffice, setShowOnlyOffice] = useState<{ messageId: number; filename: string } | null>(null);
    
    // Group creation state
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Calculate total unread
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    
    // Filter conversations
    const filteredConversations = conversations.filter(c =>
        c.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ==================== EFFECTS ====================
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchConversations();
        }
    }, [isOpen]);

    useEffect(() => {
        if (searchMode === 'users' && searchQuery) {
            const timer = setTimeout(() => fetchSearchUsers(searchQuery), 300);
            return () => clearTimeout(timer);
        }
    }, [searchQuery, searchMode]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatWindows, mobileActiveChat]);

    // Cleanup audio and recording on unmount
    useEffect(() => {
        return () => {
            // Stop any playing audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            
            // Stop any active recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
            }
            
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        };
    }, []);

    // WebSocket listeners for realtime updates
    useEffect(() => {
        if (!socketRef.current || !connected) return;

        // Listen for new messages
        socketRef.current.on('chat:new_message', (data: { conversationId: number; message: Message }) => {
            // Update chat windows
            setChatWindows(prev => prev.map(w =>
                w.conversationId === data.conversationId
                    ? { ...w, messages: [...w.messages, data.message] }
                    : w
            ));

            // Update mobile chat
            if (mobileActiveChat?.conversationId === data.conversationId) {
                setMobileActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, data.message] } : null);
            }

            // Refresh conversations list
            fetchConversations();
        });

        // Listen for typing indicator
        socketRef.current.on('chat:typing', (data: { conversationId: number; userName: string; userId: number }) => {
            if (data.userId === user?.id) return; // Ignore own typing
            
            setTypingUsers(prev => {
                const current = prev[data.conversationId] || [];
                const exists = current.some(u => u.userId === data.userId);
                if (exists) return prev;
                
                return {
                    ...prev,
                    [data.conversationId]: [...current, { userName: data.userName, userId: data.userId }]
                };
            });

            // Clear typing after 3 seconds
            if (typingTimeoutRef.current[data.conversationId]) {
                clearTimeout(typingTimeoutRef.current[data.conversationId]);
            }
            typingTimeoutRef.current[data.conversationId] = setTimeout(() => {
                setTypingUsers(prev => {
                    const current = prev[data.conversationId] || [];
                    return {
                        ...prev,
                        [data.conversationId]: current.filter(u => u.userId !== data.userId)
                    };
                });
            }, 3000);
        });

        // Listen for stop typing
        socketRef.current.on('chat:stop_typing', (data: { conversationId: number; userId: number }) => {
            setTypingUsers(prev => {
                const current = prev[data.conversationId] || [];
                return {
                    ...prev,
                    [data.conversationId]: current.filter(u => u.userId !== data.userId)
                };
            });
        });

        return () => {
            socketRef.current?.off('chat:new_message');
            socketRef.current?.off('chat:typing');
            socketRef.current?.off('chat:stop_typing');
        };
    }, [connected, socketRef, user, mobileActiveChat]);

    // ==================== API FUNCTIONS ====================
    const fetchConversations = async () => {
        if (!user || !token) return;
        
        try {
            setLoading(true);
            const response = await api.get('/chat/conversations');
            const data = response.data.map((conv: any) => ({
                ...conv,
                displayName: conv.displayName || conv.name || 'Unknown',
                displayAvatar: conv.displayAvatar || null,
                unreadCount: conv.unreadCount || 0
            }));
            setConversations(data);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSearchUsers = async (query: string) => {
        if (!query.trim()) {
            setSearchUsers([]);
            return;
        }
        
        try {
            const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
            setSearchUsers(response.data.filter((u: User) => u.id !== user?.id));
        } catch (error) {
            console.error('Error searching users:', error);
            setSearchUsers([]);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const response = await api.get('/users');
            setAllUsers(response.data.filter((u: User) => u.id !== user?.id));
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchMessages = async (conversationId: number): Promise<Message[]> => {
        try {
            const response = await api.get(`/chat/conversations/${conversationId}/messages`);
            const data = response.data;
            return Array.isArray(data) ? data : (data.messages || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    };

    // ==================== CHAT FUNCTIONS ====================
    const openChatWithUser = async (targetUser: User) => {
        try {
            const existingConv = conversations.find(c =>
                c.type === 'PRIVATE' && c.members.some(m => m.user.id === targetUser.id)
            );

            if (existingConv) {
                openConversation(existingConv);
            } else {
                const response = await api.post('/chat/conversations', {
                    type: 'PRIVATE',
                    memberIds: [targetUser.id]
                });
                
                const newConv: Conversation = {
                    ...response.data,
                    displayName: targetUser.name || targetUser.username,
                    displayAvatar: targetUser.avatarUrl || targetUser.avatar || null,
                    unreadCount: 0
                };
                
                setConversations(prev => [newConv, ...prev]);
                openConversation(newConv);
            }
            
            setSearchMode('conversations');
            setSearchQuery('');
        } catch (error) {
            console.error('Error opening chat:', error);
        }
    };

    const createGroupChat = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;
        
        try {
            const response = await api.post('/chat/conversations', {
                type: 'GROUP',
                name: groupName,
                memberIds: selectedMembers.map(m => m.id)
            });
            
            const newConv: Conversation = {
                ...response.data,
                displayName: groupName,
                displayAvatar: null,
                unreadCount: 0
            };
            
            setConversations(prev => [newConv, ...prev]);
            openConversation(newConv);
            setShowCreateGroup(false);
            setGroupName('');
            setSelectedMembers([]);
        } catch (error) {
            console.error('Error creating group:', error);
        }
    };

    const openConversation = async (conversation: Conversation) => {
        const existingWindow = chatWindows.find(w => w.conversationId === conversation.id);
        
        if (existingWindow) {
            if (isMobile) {
                setMobileActiveChat(existingWindow);
                setIsOpen(false);
            } else {
                setChatWindows(prev => prev.map(w =>
                    w.conversationId === conversation.id ? { ...w, isMinimized: false } : w
                ));
                // Đóng popup khi mở conversation
                setIsOpen(false);
            }
            return;
        }

        if (!isMobile && chatWindows.length >= 3) {
            setChatWindows(prev => prev.slice(1));
        }

        const messages = await fetchMessages(conversation.id);
        
        const newWindow: ChatWindow = {
            id: Date.now(),
            conversationId: conversation.id,
            conversation,
            isMinimized: false,
            isMaximized: false,
            messages,
            unread: 0
        };

        if (isMobile) {
            setChatWindows([newWindow]);
            setMobileActiveChat(newWindow);
            setIsOpen(false);
        } else {
            setChatWindows(prev => [...prev, newWindow]);
            // Đóng popup khi mở conversation mới
            setIsOpen(false);
        }

        // Mark as read
        try {
            await api.put(`/chat/conversations/${conversation.id}/read`);
            setConversations(prev => prev.map(c =>
                c.id === conversation.id ? { ...c, unreadCount: 0 } : c
            ));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const closeWindow = (windowId: number) => {
        setChatWindows(prev => prev.filter(w => w.id !== windowId));
        if (isMobile) setMobileActiveChat(null);
    };

    const toggleMinimize = (windowId: number) => {
        setChatWindows(prev => prev.map(w =>
            w.id === windowId ? { ...w, isMinimized: !w.isMinimized } : w
        ));
    };

    const toggleMaximize = (windowId: number) => {
        setChatWindows(prev => prev.map(w =>
            w.id === windowId ? { ...w, isMaximized: !w.isMaximized, isMinimized: false } : w
        ));
    };

    // ==================== MESSAGE FUNCTIONS ====================
    const handleInputChange = (conversationId: number, value: string) => {
        setMessageInputs(prev => ({ ...prev, [conversationId]: value }));
        
        // Emit typing indicator
        if (socketRef.current?.connected && value.trim()) {
            socketRef.current.emit('chat:typing', { 
                conversationId, 
                userName: user?.name || 'User',
                userId: user?.id
            });
        } else if (socketRef.current?.connected && !value.trim()) {
            socketRef.current.emit('chat:stop_typing', { 
                conversationId,
                userId: user?.id
            });
        }
    };

    const sendMessage = async (conversationId: number, content: string) => {
        if (!content.trim()) return;

        // Stop typing indicator
        if (socketRef.current?.connected) {
            socketRef.current.emit('chat:stop_typing', { 
                conversationId,
                userId: user?.id
            });
        }

        try {
            const response = await api.post(`/chat/conversations/${conversationId}/messages`, {
                content: content.trim(),
                messageType: 'TEXT'
            });

            const newMessage = response.data;
            
            setChatWindows(prev => prev.map(w =>
                w.conversationId === conversationId
                    ? { ...w, messages: [...w.messages, newMessage] }
                    : w
            ));

            if (mobileActiveChat?.conversationId === conversationId) {
                setMobileActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, newMessage] } : null);
            }

            setMessageInputs(prev => ({ ...prev, [conversationId]: '' }));
            fetchConversations();
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleFileUpload = async (conversationId: number, file: File) => {
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        const isImage = file.type.startsWith('image/');
        formData.append('messageType', isImage ? 'IMAGE' : 'FILE');

        try {
            setUploadProgress(prev => ({ ...prev, [conversationId]: 0 }));
            
            const response = await api.post(
                `/chat/conversations/${conversationId}/messages`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            
            setUploadProgress(prev => ({ ...prev, [conversationId]: 100 }));

            const newMessage = response.data;
            
            setChatWindows(prev => prev.map(w =>
                w.conversationId === conversationId
                    ? { ...w, messages: [...w.messages, newMessage] }
                    : w
            ));

            if (mobileActiveChat?.conversationId === conversationId) {
                setMobileActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, newMessage] } : null);
            }

            fetchConversations();
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Không thể tải file lên. Vui lòng thử lại.');
        } finally {
            setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[conversationId];
                return newProgress;
            });
        }
    };

    // ==================== VOICE RECORDING ====================
    const startRecording = async (conversationId: number) => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Trình duyệt không hỗ trợ ghi âm');
                return;
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            // Audio level analysis
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                
                // Upload voice message
                const formData = new FormData();
                formData.append('file', audioBlob, 'voice.webm');
                formData.append('messageType', 'VOICE');

                try {
                    const response = await api.post(
                        `/chat/conversations/${conversationId}/messages`,
                        formData,
                        { headers: { 'Content-Type': 'multipart/form-data' } }
                    );

                    const newMessage = response.data;
                    
                    setChatWindows(prev => prev.map(w =>
                        w.conversationId === conversationId
                            ? { ...w, messages: [...w.messages, newMessage] }
                            : w
                    ));

                    if (mobileActiveChat?.conversationId === conversationId) {
                        setMobileActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, newMessage] } : null);
                    }

                    fetchConversations();
                } catch (error) {
                    console.error('Error sending voice message:', error);
                }
            };

            mediaRecorder.start();
            setIsRecording(conversationId);
            setRecordingTime(0);

            // Update recording time and audio level
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
                
                if (analyserRef.current) {
                    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    setAudioLevel(avg / 255);
                }
            }, 1000);

        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Không thể bắt đầu ghi âm. Vui lòng kiểm tra quyền truy cập microphone.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
        }
        setIsRecording(null);
        setRecordingTime(0);
        setAudioLevel(0);
    };

    // ==================== AUDIO PLAYBACK ====================
    const toggleAudioPlayback = (messageId: number, audioUrl: string) => {
        if (playingAudio === messageId) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingAudio(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            audioRef.current = new Audio(audioUrl);
            audioRef.current.play().catch(err => {
                console.error('Error playing audio:', err);
                setPlayingAudio(null);
            });
            audioRef.current.onended = () => {
                setPlayingAudio(null);
                audioRef.current = null;
            };
            setPlayingAudio(messageId);
        }
    };

    // ==================== RENDER MESSAGE ====================
    const renderMessage = (msg: Message, isOwn: boolean) => {
        const filename = msg.attachmentName || extractFilename(msg.attachment || '');

        switch (msg.messageType) {
            case 'VOICE':
                return (
                    <div className="flex items-center gap-2 min-w-[180px]">
                        <button
                            onClick={() => msg.attachmentUrl && toggleAudioPlayback(msg.id, msg.attachmentUrl)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                        >
                            {playingAudio === msg.id ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <div className="flex items-center gap-0.5 flex-1">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-0.5 rounded-full ${isOwn ? 'bg-white/60' : 'bg-gray-400'}`}
                                    style={{ height: `${Math.random() * 16 + 4}px` }}
                                />
                            ))}
                        </div>
                        <Volume2 size={14} className={isOwn ? 'text-white/70' : 'text-gray-500'} />
                    </div>
                );

            case 'IMAGE':
                return msg.attachmentUrl && (
                    <img
                        src={msg.attachmentUrl}
                        alt="Image"
                        className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                        style={{ maxHeight: '200px' }}
                        onClick={() => setImagePreview(msg.attachmentUrl)}
                    />
                );

            case 'FILE':
            case 'TEXT_WITH_FILE':
                return (
                    <div>
                        {msg.content && <p className="mb-2 whitespace-pre-wrap break-words">{msg.content}</p>}
                        {msg.attachmentUrl && (
                            <div className={`flex items-center gap-2 p-2 rounded-lg ${isOwn ? 'bg-white/10' : 'bg-gray-100'}`}>
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${getFileIconColor(filename)}`}>
                                    <FileText size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-gray-800'}`}>
                                        {filename}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    {isOfficeFile(filename) && (
                                        <button
                                            onClick={() => setShowOnlyOffice({ messageId: msg.id, filename })}
                                            className={`p-1.5 rounded ${isOwn ? 'hover:bg-white/20' : 'hover:bg-gray-200'}`}
                                            title="Xem file"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    )}
                                    <a
                                        href={msg.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`p-1.5 rounded ${isOwn ? 'hover:bg-white/20' : 'hover:bg-gray-200'}`}
                                        title="Tải xuống"
                                    >
                                        <Download size={16} />
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                );

            default:
                return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
        }
    };

    // ==================== RENDER CHAT WINDOW ====================
    const renderChatWindow = (window: ChatWindow, index: number) => {
        const conversationId = window.conversationId;
        const messageInput = messageInputs[conversationId] || '';
        const progress = uploadProgress[conversationId];

        const baseRight = 100 + index * 340;
        const windowStyle: React.CSSProperties = window.isMaximized
            ? { position: 'fixed', bottom: 20, right: baseRight, width: 500, height: 600, zIndex: 50 }
            : { position: 'fixed', bottom: 20, right: baseRight, width: 360, height: window.isMinimized ? 48 : 500, zIndex: 50 };

        return (
            <div
                key={window.id}
                className="bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-200"
                style={windowStyle}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white cursor-pointer shrink-0 shadow-md"
                    onClick={() => toggleMinimize(window.id)}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white/30">
                                {window.conversation.displayAvatar ? (
                                    <img src={window.conversation.displayAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm font-semibold">{window.conversation.displayName.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                        </div>
                        <div className="min-w-0">
                            <span className="font-semibold text-sm truncate block">{window.conversation.displayName}</span>
                            <span className="text-xs text-blue-100">Đang hoạt động</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleMinimize(window.id); }} 
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            title="Thu nhỏ"
                        >
                            <Minimize2 size={16} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleMaximize(window.id); }} 
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            title="Phóng to"
                        >
                            <Maximize2 size={16} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); closeWindow(window.id); }} 
                            className="p-2 hover:bg-red-500/30 rounded-lg transition-colors"
                            title="Đóng"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                {!window.isMinimized && (
                    <>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white">
                            {window.messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                                    <MessageSquare size={48} className="mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Bắt đầu cuộc trò chuyện</p>
                                    <p className="text-xs mt-1">Gửi tin nhắn đầu tiên của bạn</p>
                                </div>
                            ) : (
                                <>
                                    {window.messages.map(msg => {
                                        const isOwn = msg.sender.id === user?.id;
                                        return (
                                            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                                                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                                                    {!isOwn && (
                                                        <p className="text-xs text-gray-500 mb-1 ml-3 font-medium">{msg.sender.name}</p>
                                                    )}
                                                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm transition-all hover:shadow-md ${
                                                        isOwn 
                                                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm' 
                                                            : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                                                    }`}>
                                                        {renderMessage(msg, isOwn)}
                                                    </div>
                                                    <p className={`text-xs mt-1 text-gray-400 ${isOwn ? 'text-right mr-2' : 'ml-3'}`}>
                                                        {formatMessageTime(msg.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Typing indicator */}
                                    {typingUsers[conversationId] && typingUsers[conversationId].length > 0 && (
                                        <div className="flex justify-start animate-fadeIn">
                                            <div className="max-w-[75%] flex flex-col items-start">
                                                <p className="text-xs text-gray-500 mb-1 ml-3 font-medium">
                                                    {typingUsers[conversationId].map(u => u.userName).join(', ')}
                                                </p>
                                                <div className="px-4 py-2.5 rounded-2xl bg-gray-200 text-gray-800 rounded-bl-sm">
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Upload Progress */}
                        {progress !== undefined && (
                            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-100">
                                <div className="flex items-center gap-3">
                                    <Loader2 className="animate-spin text-blue-600" size={18} />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-blue-700 font-medium">Đang tải lên...</span>
                                            <span className="text-xs text-blue-600 font-bold">{progress}%</span>
                                        </div>
                                        <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300" 
                                                style={{ width: `${progress}%` }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-2 border-t border-gray-200 bg-white shrink-0">
                            {isRecording === conversationId ? (
                                <div className="flex items-center gap-2 px-1 py-1">
                                    <div
                                        className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center animate-pulse shrink-0"
                                        style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
                                    >
                                        <Mic size={16} className="text-white" />
                                    </div>
                                    <span className="text-xs font-medium text-red-600">{formatTime(recordingTime)}</span>
                                    <div className="flex-1 flex items-center justify-center gap-0.5 min-w-0">
                                        {Array.from({ length: 15 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-0.5 bg-red-400 rounded-full transition-all"
                                                style={{ height: `${Math.max(3, Math.random() * 16 * audioLevel)}px` }}
                                            />
                                        ))}
                                    </div>
                                    <button onClick={stopRecording} className="p-1.5 bg-red-100 hover:bg-red-200 rounded-full transition-colors shrink-0">
                                        <MicOff size={16} className="text-red-600" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    {/* Emoji Picker */}
                                    <div className="relative shrink-0">
                                        <button
                                            onClick={() => setShowEmojiPicker(showEmojiPicker === conversationId ? null : conversationId)}
                                            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                                            title="Emoji"
                                        >
                                            <Smile size={18} />
                                        </button>
                                        {showEmojiPicker === conversationId && (
                                            <>
                                                {/* Backdrop */}
                                                <div 
                                                    className="fixed inset-0 z-[9998]" 
                                                    onClick={() => setShowEmojiPicker(null)}
                                                />
                                                {/* Emoji Panel */}
                                                <div className="fixed bottom-20 left-4 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-[9999] w-[180px]">
                                                    <div className="text-xs font-semibold text-gray-600 mb-2">Chọn emoji</div>
                                                    <div className="grid grid-cols-4 gap-1 max-h-[200px] overflow-y-auto scrollbar-hide">
                                                        {EMOJI_LIST.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => {
                                                                    setMessageInputs(prev => ({
                                                                        ...prev,
                                                                        [conversationId]: (prev[conversationId] || '') + emoji
                                                                    }));
                                                                    setShowEmojiPicker(null);
                                                                }}
                                                                className="text-xl hover:bg-gray-100 rounded-lg p-1.5 transition-colors flex items-center justify-center"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* File Upload */}
                                    <input
                                        type="file"
                                        id={`file-input-${conversationId}`}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                handleFileUpload(conversationId, file);
                                                e.target.value = '';
                                            }
                                        }}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => document.getElementById(`file-input-${conversationId}`)?.click()}
                                        className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors shrink-0"
                                        title="Đính kèm"
                                    >
                                        <Paperclip size={18} />
                                    </button>

                                    {/* Text Input */}
                                    <input
                                        type="text"
                                        value={messageInput}
                                        onChange={(e) => handleInputChange(conversationId, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendMessage(conversationId, messageInput);
                                            }
                                        }}
                                        placeholder="Aa"
                                        className="flex-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                                    />

                                    {/* Voice Button - Always visible */}
                                    <button
                                        onClick={() => startRecording(conversationId)}
                                        className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors shrink-0"
                                        title="Ghi âm"
                                    >
                                        <Mic size={18} />
                                    </button>

                                    {/* Send Button - Always visible */}
                                    <button
                                        onClick={() => sendMessage(conversationId, messageInput)}
                                        disabled={!messageInput.trim()}
                                        className={`p-1.5 rounded-full transition-all shrink-0 ${
                                            messageInput.trim() 
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                        title="Gửi"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    // ==================== RENDER MOBILE CHAT ====================
    const renderMobileChat = () => {
        if (!mobileActiveChat) return null;

        const conversationId = mobileActiveChat.conversationId;
        const messageInput = messageInputs[conversationId] || '';
        const progress = uploadProgress[conversationId];

        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white shrink-0">
                    <button onClick={() => { setMobileActiveChat(null); setIsOpen(true); }} className="p-2 hover:bg-white/20 rounded-lg">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                        {mobileActiveChat.conversation.displayAvatar ? (
                            <img src={mobileActiveChat.conversation.displayAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="font-medium">{mobileActiveChat.conversation.displayName.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <span className="flex-1 font-medium truncate">{mobileActiveChat.conversation.displayName}</span>
                    <button onClick={() => closeWindow(mobileActiveChat.id)} className="p-2 hover:bg-white/20 rounded-lg">
                        <X size={24} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {mobileActiveChat.messages.map(msg => {
                        const isOwn = msg.sender.id === user?.id;
                        return (
                            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div className="max-w-[80%]">
                                    {!isOwn && <p className="text-xs text-gray-500 mb-1 ml-2">{msg.sender.name}</p>}
                                    <div className={`px-3 py-2 rounded-2xl ${
                                        isOwn ? 'bg-blue-500 text-white rounded-br-md' : 'bg-gray-200 text-gray-800 rounded-bl-md'
                                    }`}>
                                        {renderMessage(msg, isOwn)}
                                    </div>
                                    <p className={`text-xs mt-1 text-gray-400 ${isOwn ? 'text-right' : ''}`}>
                                        {formatMessageTime(msg.createdAt)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Typing indicator for mobile */}
                    {typingUsers[conversationId] && typingUsers[conversationId].length > 0 && (
                        <div className="flex justify-start animate-fadeIn">
                            <div className="max-w-[80%]">
                                <p className="text-xs text-gray-500 mb-1 ml-2">
                                    {typingUsers[conversationId].map(u => u.userName).join(', ')}
                                </p>
                                <div className="px-3 py-2 rounded-2xl bg-gray-200 text-gray-800 rounded-bl-md">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Upload Progress */}
                {progress !== undefined && (
                    <div className="px-4 py-2 bg-blue-50 border-t">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-sm text-blue-600">{progress}%</span>
                        </div>
                    </div>
                )}

                {/* Input */}
                <div className="p-3 border-t bg-white shrink-0">
                    {isRecording === conversationId ? (
                        <div className="flex items-center gap-4 px-3 py-2">
                            <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                                <Mic size={24} className="text-white" />
                            </div>
                            <span className="text-lg font-medium text-red-600">{formatTime(recordingTime)}</span>
                            <div className="flex-1" />
                            <button onClick={stopRecording} className="p-3 bg-gray-200 rounded-full">
                                <MicOff size={24} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowEmojiPicker(showEmojiPicker === conversationId ? null : conversationId)}
                                className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                            >
                                <Smile size={24} />
                            </button>
                            <input
                                type="file"
                                id={`mobile-file-input-${conversationId}`}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        handleFileUpload(conversationId, file);
                                        e.target.value = '';
                                    }
                                }}
                                className="hidden"
                            />
                            <button 
                                onClick={() => document.getElementById(`mobile-file-input-${conversationId}`)?.click()} 
                                className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                            >
                                <Paperclip size={24} />
                            </button>
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => handleInputChange(conversationId, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        sendMessage(conversationId, messageInput);
                                    }
                                }}
                                placeholder="Nhập tin nhắn..."
                                className="flex-1 px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {/* Send Button - Always visible */}
                            <button
                                onClick={() => sendMessage(conversationId, messageInput)}
                                disabled={!messageInput.trim()}
                                className={`p-3 rounded-full transition-colors ${
                                    messageInput.trim() 
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                        : 'bg-gray-100 text-gray-400'
                                }`}
                            >
                                <Send size={24} />
                            </button>
                            <button onClick={() => startRecording(conversationId)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                                <Mic size={24} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile Emoji Picker */}
                {showEmojiPicker === conversationId && (
                    <div className="absolute bottom-20 left-4 bg-white rounded-xl shadow-xl border p-3 grid grid-cols-8 gap-2 z-50">
                        {EMOJI_LIST.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => {
                                    setMessageInputs(prev => ({
                                        ...prev,
                                        [conversationId]: (prev[conversationId] || '') + emoji
                                    }));
                                    setShowEmojiPicker(null);
                                }}
                                className="text-2xl hover:bg-gray-100 rounded p-1"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // ==================== RENDER CREATE GROUP MODAL ====================
    const renderCreateGroupModal = () => {
        if (!showCreateGroup) return null;

        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h3 className="font-semibold text-lg">Tạo nhóm chat</h3>
                        <button onClick={() => setShowCreateGroup(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-4 space-y-4 overflow-y-auto flex-1">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhóm</label>
                            <input
                                type="text"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder="Nhập tên nhóm..."
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Thành viên ({selectedMembers.length} đã chọn)
                            </label>
                            <div className="max-h-48 overflow-y-auto border rounded-lg">
                                {allUsers.map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => {
                                            if (selectedMembers.some(m => m.id === u.id)) {
                                                setSelectedMembers(prev => prev.filter(m => m.id !== u.id));
                                            } else {
                                                setSelectedMembers(prev => [...prev, u]);
                                            }
                                        }}
                                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${
                                            selectedMembers.some(m => m.id === u.id) ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                            {u.avatarUrl || u.avatar ? (
                                                <img src={u.avatarUrl || u.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                <span className="text-sm font-medium text-blue-600">{u.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span className="flex-1">{u.name}</span>
                                        {selectedMembers.some(m => m.id === u.id) && (
                                            <Check size={18} className="text-blue-600" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t">
                        <button
                            onClick={createGroupChat}
                            disabled={!groupName.trim() || selectedMembers.length === 0}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Tạo nhóm
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ==================== MAIN RENDER ====================
    // Don't render if user is not logged in
    if (!user || !token) {
        return null;
    }
    
    return (
        <>
            {/* Chat Button */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
                >
                    <MessageCircle size={22} className="text-gray-600" />
                    {totalUnread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                            {totalUnread > 9 ? '9+' : totalUnread}
                        </span>
                    )}
                </button>

                {/* Chat List Panel */}
                {isOpen && (
                    <div className={`absolute ${isMobile ? 'fixed inset-0 z-50' : 'top-full right-0 mt-2 w-96'} bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[600px]`}>
                        {/* Header */}
                        <div className="p-4 border-b bg-white shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-xl text-gray-800">Chat</h3>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setShowCreateGroup(true);
                                            fetchAllUsers();
                                        }}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                                        title="Tạo nhóm"
                                    >
                                        <Plus size={20} />
                                    </button>
                                    {isMobile && (
                                        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Search */}
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Tìm kiếm mọi người..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-100 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white border border-transparent focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex border-b bg-white shrink-0">
                            <button
                                onClick={() => setSearchMode('conversations')}
                                className={`flex-1 py-3 px-4 text-sm font-medium transition-all relative ${
                                    searchMode === 'conversations' 
                                        ? 'text-blue-600' 
                                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                <MessageSquare size={16} className="inline mr-2" />
                                Trò chuyện gần đây
                                {searchMode === 'conversations' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                )}
                            </button>
                            <button
                                onClick={() => setSearchMode('users')}
                                className={`flex-1 py-3 px-4 text-sm font-medium transition-all relative ${
                                    searchMode === 'users' 
                                        ? 'text-blue-600' 
                                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                <Users size={16} className="inline mr-2" />
                                Người dùng
                                {searchMode === 'users' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                )}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={28} className="animate-spin text-blue-600" />
                                </div>
                            ) : searchMode === 'conversations' ? (
                                filteredConversations.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 px-4">
                                        <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                                        <p className="text-sm font-medium">Chưa có trò chuyện nào</p>
                                        <p className="text-xs mt-1 text-gray-400">Bắt đầu cuộc trò chuyện mới</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {filteredConversations.map(conv => (
                                            <div
                                                key={conv.id}
                                                onClick={() => openConversation(conv)}
                                                className="flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                                            >
                                                <div className="relative shrink-0">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-lg overflow-hidden ring-2 ring-white">
                                                        {conv.displayAvatar ? (
                                                            <img src={conv.displayAvatar} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            conv.displayName.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    {conv.unreadCount > 0 && (
                                                        <div className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5 ring-2 ring-white">
                                                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline justify-between mb-0.5">
                                                        <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                                            {conv.displayName}
                                                        </p>
                                                        {conv.lastMessage && (
                                                            <span className="text-xs text-gray-400 ml-2 shrink-0">
                                                                {formatMessageTime(conv.lastMessage.createdAt)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {typingUsers[conv.id] && typingUsers[conv.id].length > 0 ? (
                                                        <p className="text-sm text-blue-600 font-medium italic flex items-center gap-1">
                                                            <span className="inline-flex gap-0.5">
                                                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                            </span>
                                                            {typingUsers[conv.id][0].userName} đang nhập...
                                                        </p>
                                                    ) : conv.lastMessage ? (
                                                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                            {conv.lastMessage.messageType === 'VOICE' ? '🎤 Tin nhắn thoại' :
                                                             conv.lastMessage.messageType === 'IMAGE' ? '🖼️ Hình ảnh' :
                                                             conv.lastMessage.messageType === 'FILE' ? '📎 Tệp đính kèm' :
                                                             conv.lastMessage.content}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                searchUsers.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 px-4">
                                        <Users size={48} className="mx-auto mb-3 opacity-30" />
                                        <p className="text-sm font-medium">{searchQuery ? 'Không tìm thấy người dùng' : 'Tìm kiếm người dùng'}</p>
                                        <p className="text-xs mt-1 text-gray-400">Nhập tên để bắt đầu tìm kiếm</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {searchUsers.map(u => (
                                            <div
                                                key={u.id}
                                                onClick={() => openChatWithUser(u)}
                                                className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-lg shrink-0 overflow-hidden ring-2 ring-white">
                                                    {u.avatarUrl || u.avatar ? (
                                                        <img src={u.avatarUrl || u.avatar} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        u.name.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{u.name}</p>
                                                    <p className="text-sm text-gray-500 truncate">@{u.username}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Chat View */}
            {isMobile && mobileActiveChat && renderMobileChat()}

            {/* Desktop Chat Windows */}
            {!isMobile && chatWindows.map((w, i) => renderChatWindow(w, i))}

            {/* Create Group Modal */}
            {renderCreateGroupModal()}

            {/* Image Preview Modal */}
            {imagePreview && (
                <div
                    className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
                    onClick={() => setImagePreview(null)}
                >
                    <button className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white">
                        <X size={24} />
                    </button>
                    <img src={imagePreview} alt="Preview" className="max-w-full max-h-full object-contain" />
                </div>
            )}

            {/* OnlyOffice Viewer */}
            {showOnlyOffice && token && (
                <DiscussionOnlyOfficeViewer
                    messageId={showOnlyOffice.messageId}
                    fileName={showOnlyOffice.filename}
                    onClose={() => setShowOnlyOffice(null)}
                    token={token}
                />
            )}
        </>
    );
};

export default ChatPopup;

