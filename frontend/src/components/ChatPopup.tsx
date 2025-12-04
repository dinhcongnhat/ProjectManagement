import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, X, Minimize2, Maximize2, Send, Search,
    Image, Paperclip, Mic, MicOff, Smile, Users, Plus,
    Play, Pause, Volume2, FileText, Download, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { API_URL } from '../config/api';

// Types
interface User {
    id: number;
    name: string;
    username: string;
    avatar?: string;
    avatarUrl?: string;
    position?: string;
}

interface Conversation {
    id: number;
    name?: string;
    type: 'PRIVATE' | 'GROUP';
    displayName: string;
    displayAvatar?: string;
    unreadCount: number;
    lastMessage?: {
        content?: string;
        messageType: string;
        createdAt: string;
        sender: { id: number; name: string };
    };
    members: Array<{
        user: User;
        role: string;
    }>;
}

interface ChatMessage {
    id: number;
    content?: string;
    messageType: 'TEXT' | 'VOICE' | 'FILE' | 'IMAGE' | 'TEXT_WITH_FILE';
    attachment?: string;
    attachmentUrl?: string;
    createdAt: string;
    sender: {
        id: number;
        name: string;
        avatar?: string;
        avatarUrl?: string;
    };
}

interface ChatWindow {
    id: number;
    conversationId: number;
    conversation: Conversation;
    isMinimized: boolean;
    messages: ChatMessage[];
    unread: number;
}

// Emoji data
const emojiCategories = [
    { name: 'Smileys', emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😜', '🤪', '😎', '🤩', '🥳'] },
    { name: 'Gestures', emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🖐️', '✋', '👏', '🙌', '🤝', '🙏', '💪', '❤️', '🔥', '⭐', '✨'] },
    { name: 'Objects', emojis: ['📱', '💻', '📧', '📁', '📅', '📌', '📎', '✏️', '📝', '📊', '📈', '💼', '🎯', '🚀', '💡', '🔔', '⏰', '📞', '🎉', '🎊'] }
];

const ChatPopup: React.FC = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [chatWindows, setChatWindows] = useState<ChatWindow[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<'conversations' | 'users'>('conversations');
    const [searchUsers, setSearchUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
    const [messageInputs, setMessageInputs] = useState<{ [key: number]: string }>({});
    
    // Mobile state - on mobile, only show one chat at a time in fullscreen
    const [isMobile, setIsMobile] = useState(false);
    const [mobileActiveChat, setMobileActiveChat] = useState<ChatWindow | null>(null);
    
    // Voice recording states
    const [isRecording, setIsRecording] = useState<number | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // File upload states
    const [uploadProgress, setUploadProgress] = useState<{ [key: number]: number }>({});
    const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

    // Audio playback
    const [playingAudio, setPlayingAudio] = useState<number | null>(null);
    const audioRefs = useRef<{ [key: number]: HTMLAudioElement }>({});

    // Check if mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Total unread count
    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

    // Fetch conversations
    const fetchConversations = useCallback(async () => {
        try {
            const response = await api.get('/chat/conversations');
            setConversations(response.data);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        }
    }, []);

    // Fetch users for search
    const fetchSearchUsers = useCallback(async (query: string) => {
        try {
            setLoading(true);
            const response = await api.get(`/chat/users/search?q=${encodeURIComponent(query)}`);
            setSearchUsers(response.data);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load conversations on mount
    useEffect(() => {
        if (isOpen) {
            fetchConversations();
        }
    }, [isOpen, fetchConversations]);

    // Search effect
    useEffect(() => {
        if (searchMode === 'users' && searchQuery) {
            const timer = setTimeout(() => {
                fetchSearchUsers(searchQuery);
            }, 300);
            return () => clearTimeout(timer);
        } else if (searchMode === 'users' && !searchQuery) {
            fetchSearchUsers('');
        }
    }, [searchQuery, searchMode, fetchSearchUsers]);

    // Fetch messages for a conversation
    const fetchMessages = async (conversationId: number): Promise<ChatMessage[]> => {
        try {
            const response = await api.get(`/chat/conversations/${conversationId}/messages`);
            return response.data;
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    };

    // Open chat with a user (create or find existing conversation)
    const openChatWithUser = async (targetUser: User) => {
        try {
            // Check if conversation already exists
            const existingConv = conversations.find(c => 
                c.type === 'PRIVATE' && 
                c.members.some(m => m.user.id === targetUser.id)
            );

            if (existingConv) {
                openConversation(existingConv);
                setSearchMode('conversations');
                setSearchQuery('');
                return;
            }

            // Create new conversation
            const response = await api.post('/chat/conversations', {
                type: 'PRIVATE',
                memberIds: [targetUser.id]
            });

            const newConversation = response.data;
            setConversations(prev => [newConversation, ...prev]);
            openConversation(newConversation);
            setSearchMode('conversations');
            setSearchQuery('');
        } catch (error) {
            console.error('Error opening chat with user:', error);
        }
    };

    // Open a conversation window
    const openConversation = async (conversation: Conversation) => {
        // Check if already open
        const existingWindow = chatWindows.find(w => w.conversationId === conversation.id);
        if (existingWindow) {
            // On mobile, set as active chat
            if (isMobile) {
                setMobileActiveChat(existingWindow);
                setIsOpen(false);
            } else {
                // Maximize if minimized
                setChatWindows(prev => prev.map(w => 
                    w.conversationId === conversation.id 
                        ? { ...w, isMinimized: false }
                        : w
                ));
            }
            return;
        }

        // Limit to 3 windows on desktop, 1 on mobile
        if (!isMobile && chatWindows.length >= 3) {
            setChatWindows(prev => prev.slice(1));
        }

        // Fetch messages
        const messages = await fetchMessages(conversation.id);

        // Add new window
        const newWindow: ChatWindow = {
            id: Date.now(),
            conversationId: conversation.id,
            conversation,
            isMinimized: false,
            messages,
            unread: 0
        };

        if (isMobile) {
            setChatWindows([newWindow]);
            setMobileActiveChat(newWindow);
            setIsOpen(false);
        } else {
            setChatWindows(prev => [...prev, newWindow]);
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

    // Close a chat window
    const closeWindow = (windowId: number) => {
        setChatWindows(prev => prev.filter(w => w.id !== windowId));
        if (isMobile) {
            setMobileActiveChat(null);
        }
    };

    // Close mobile chat and go back to list
    const closeMobileChat = () => {
        setMobileActiveChat(null);
        setIsOpen(true);
    };

    // Toggle minimize
    const toggleMinimize = (windowId: number) => {
        setChatWindows(prev => prev.map(w => 
            w.id === windowId ? { ...w, isMinimized: !w.isMinimized } : w
        ));
    };

    // Send text message
    const sendMessage = async (conversationId: number) => {
        const content = messageInputs[conversationId]?.trim();
        if (!content) return;

        try {
            const response = await api.post(`/chat/conversations/${conversationId}/messages`, {
                content
            });

            // Add message to window
            setChatWindows(prev => prev.map(w => 
                w.conversationId === conversationId
                    ? { ...w, messages: [...w.messages, response.data] }
                    : w
            ));

            // Clear input
            setMessageInputs(prev => ({ ...prev, [conversationId]: '' }));

            // Update conversation list
            fetchConversations();
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // Handle file upload
    const handleFileUpload = async (conversationId: number, file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        const content = messageInputs[conversationId]?.trim();
        if (content) {
            formData.append('content', content);
        }

        try {
            // Create XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(prev => ({ ...prev, [conversationId]: progress }));
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const response = JSON.parse(xhr.responseText);
                    setChatWindows(prev => prev.map(w => 
                        w.conversationId === conversationId
                            ? { ...w, messages: [...w.messages, response] }
                            : w
                    ));
                    setMessageInputs(prev => ({ ...prev, [conversationId]: '' }));
                    fetchConversations();
                }
                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[conversationId];
                    return newProgress;
                });
            };

            xhr.onerror = () => {
                console.error('Error uploading file');
                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[conversationId];
                    return newProgress;
                });
            };

            xhr.open('POST', `${API_URL}/chat/conversations/${conversationId}/messages/file`);
            xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
            xhr.send(formData);
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    };

    // Start voice recording
    const startRecording = async (conversationId: number) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Setup audio context for level visualization
            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            // Animate audio level
            const updateLevel = () => {
                if (analyserRef.current) {
                    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                    setAudioLevel(average / 255);
                }
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();

            // Setup media recorder
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Stop visualization
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
                stream.getTracks().forEach(track => track.stop());

                // Create and send audio blob
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await sendVoiceMessage(conversationId, audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(conversationId);
            setRecordingTime(0);

            // Timer
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Không thể truy cập microphone. Vui lòng cho phép quyền truy cập.');
        }
    };

    // Stop voice recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(null);
            setRecordingTime(0);
            setAudioLevel(0);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        }
    };

    // Send voice message
    const sendVoiceMessage = async (conversationId: number, audioBlob: Blob) => {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');

        try {
            const response = await api.post(
                `/chat/conversations/${conversationId}/messages/voice`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            setChatWindows(prev => prev.map(w => 
                w.conversationId === conversationId
                    ? { ...w, messages: [...w.messages, response.data] }
                    : w
            ));

            fetchConversations();
        } catch (error) {
            console.error('Error sending voice message:', error);
        }
    };

    // Toggle audio playback
    const toggleAudioPlayback = (messageId: number, audioUrl: string) => {
        if (playingAudio === messageId) {
            audioRefs.current[messageId]?.pause();
            setPlayingAudio(null);
        } else {
            // Pause any playing audio
            if (playingAudio !== null && audioRefs.current[playingAudio]) {
                audioRefs.current[playingAudio].pause();
            }

            // Play new audio
            if (!audioRefs.current[messageId]) {
                audioRefs.current[messageId] = new Audio(audioUrl);
                audioRefs.current[messageId].onended = () => setPlayingAudio(null);
            }
            audioRefs.current[messageId].play();
            setPlayingAudio(messageId);
        }
    };

    // Format time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Format message time
    const formatMessageTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        if (isToday) {
            return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    // Render message content
    const renderMessageContent = (msg: ChatMessage) => {
        switch (msg.messageType) {
            case 'VOICE':
                return (
                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                        <button
                            onClick={() => msg.attachmentUrl && toggleAudioPlayback(msg.id, msg.attachmentUrl)}
                            className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
                        >
                            {playingAudio === msg.id ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <div className="flex-1 h-1 bg-gray-300 rounded">
                            <div className="h-full bg-blue-500 rounded" style={{ width: '0%' }} />
                        </div>
                        <Volume2 size={16} className="text-gray-500" />
                    </div>
                );
            
            case 'IMAGE':
                return (
                    <div>
                        {msg.attachmentUrl && (
                            <img 
                                src={msg.attachmentUrl} 
                                alt="Image" 
                                className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                                style={{ maxHeight: '200px' }}
                                onClick={() => window.open(msg.attachmentUrl, '_blank')}
                            />
                        )}
                    </div>
                );
            
            case 'FILE':
            case 'TEXT_WITH_FILE':
                return (
                    <div>
                        {msg.content && <p className="mb-2">{msg.content}</p>}
                        {msg.attachmentUrl && (
                            <a 
                                href={msg.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 hover:bg-gray-200"
                            >
                                <FileText size={20} className="text-blue-500" />
                                <span className="text-sm truncate">Tệp đính kèm</span>
                                <Download size={16} className="text-gray-500" />
                            </a>
                        )}
                    </div>
                );
            
            default:
                return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
        }
    };

    // Filter conversations by search
    const filteredConversations = conversations.filter(c => 
        c.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            {/* Chat Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-all touch-target"
            >
                <MessageCircle size={24} />
                {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                )}
            </button>

            {/* Chat List Panel */}
            {isOpen && (
                <div className={`fixed bg-white shadow-2xl z-50 overflow-hidden border border-gray-200 ${
                    isMobile 
                        ? 'inset-0 rounded-none' 
                        : 'bottom-24 right-6 w-80 rounded-lg max-h-[80vh]'
                }`}>
                    {/* Header */}
                    <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between safe-top">
                        <h3 className="font-semibold text-lg">Tin nhắn</h3>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setSearchMode(searchMode === 'users' ? 'conversations' : 'users')}
                                className="p-2 hover:bg-blue-500 active:bg-blue-400 rounded-lg touch-target"
                                title={searchMode === 'users' ? 'Xem cuộc trò chuyện' : 'Tìm người để nhắn tin'}
                            >
                                {searchMode === 'users' ? <MessageCircle size={20} /> : <Users size={20} />}
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)} 
                                className="p-2 hover:bg-blue-500 active:bg-blue-400 rounded-lg touch-target"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="p-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchMode === 'users' ? 'Tìm người để nhắn tin...' : 'Tìm cuộc trò chuyện...'}
                                className="w-full pl-10 pr-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {searchMode === 'users' && (
                            <p className="text-xs text-gray-500 mt-2 px-1">Nhấn vào người dùng để bắt đầu trò chuyện</p>
                        )}
                    </div>

                    {/* Content */}
                    <div className={`overflow-y-auto ${isMobile ? 'h-[calc(100vh-140px)]' : 'max-h-96'}`}>
                        {searchMode === 'users' ? (
                            // User search results
                            loading ? (
                                <div className="p-4 text-center text-gray-500">Đang tìm kiếm...</div>
                            ) : searchUsers.length > 0 ? (
                                searchUsers.map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => openChatWithUser(u)}
                                        className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b touch-target"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {u.avatarUrl || u.avatar ? (
                                                <img src={u.avatarUrl || u.avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-gray-600 font-medium text-lg">{u.name.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate text-base">{u.name}</p>
                                            <p className="text-sm text-gray-500 truncate">{u.position || u.username}</p>
                                        </div>
                                        <Plus size={20} className="text-blue-500 flex-shrink-0" />
                                    </div>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-500">
                                    {searchQuery ? 'Không tìm thấy người dùng' : 'Nhập tên để tìm kiếm'}
                                </div>
                            )
                        ) : (
                            // Conversation list
                            filteredConversations.length > 0 ? (
                                filteredConversations.map(conv => (
                                    <div
                                        key={conv.id}
                                        onClick={() => openConversation(conv)}
                                        className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b touch-target"
                                    >
                                        <div className="relative flex-shrink-0">
                                            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                                                {conv.displayAvatar ? (
                                                    <img src={conv.displayAvatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-gray-600 font-medium text-lg">
                                                        {conv.displayName.charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            {conv.unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium text-gray-900 truncate text-base">{conv.displayName}</p>
                                                {conv.lastMessage && (
                                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                                        {formatMessageTime(conv.lastMessage.createdAt)}
                                                    </span>
                                                )}
                                            </div>
                                            {conv.lastMessage && (
                                                <p className="text-sm text-gray-500 truncate mt-1">
                                                    {conv.lastMessage.sender.id === user?.id ? 'Bạn: ' : ''}
                                                    {conv.lastMessage.messageType === 'TEXT' 
                                                        ? conv.lastMessage.content 
                                                        : conv.lastMessage.messageType === 'VOICE' 
                                                            ? '🎤 Tin nhắn thoại'
                                                            : conv.lastMessage.messageType === 'IMAGE'
                                                                ? '📷 Hình ảnh'
                                                                : '📎 Tệp đính kèm'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-500">
                                    {searchQuery ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện nào'}
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* Mobile Full-screen Chat */}
            {isMobile && mobileActiveChat && (
                <div className="fixed inset-0 bg-white z-50 flex flex-col">
                    {/* Header */}
                    <div className="bg-blue-600 text-white px-3 py-3 flex items-center gap-3 safe-top">
                        <button 
                            onClick={closeMobileChat}
                            className="p-2 hover:bg-blue-500 active:bg-blue-400 rounded-lg touch-target"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {mobileActiveChat.conversation.displayAvatar ? (
                                <img src={mobileActiveChat.conversation.displayAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-base font-medium">
                                    {mobileActiveChat.conversation.displayName.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <span className="font-semibold text-lg truncate flex-1">{mobileActiveChat.conversation.displayName}</span>
                        <button 
                            onClick={() => closeWindow(mobileActiveChat.id)}
                            className="p-2 hover:bg-blue-500 active:bg-blue-400 rounded-lg touch-target"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
                        {mobileActiveChat.messages.map(msg => {
                            const isOwn = msg.sender.id === user?.id;
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] ${isOwn ? 'order-2' : 'order-1'}`}>
                                        {!isOwn && (
                                            <p className="text-xs text-gray-500 mb-1 px-1">{msg.sender.name}</p>
                                        )}
                                        <div className={`rounded-2xl px-4 py-2.5 ${
                                            isOwn 
                                                ? 'bg-blue-500 text-white' 
                                                : 'bg-white border border-gray-200'
                                        }`}>
                                            {renderMessageContent(msg)}
                                        </div>
                                        <p className={`text-xs text-gray-400 mt-1 px-1 ${isOwn ? 'text-right' : ''}`}>
                                            {formatMessageTime(msg.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Upload progress */}
                    {uploadProgress[mobileActiveChat.conversationId] !== undefined && (
                        <div className="px-4 py-2 bg-gray-100 border-t">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-gray-300 rounded-full">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full transition-all" 
                                        style={{ width: `${uploadProgress[mobileActiveChat.conversationId]}%` }}
                                    />
                                </div>
                                <span className="text-sm text-gray-500">
                                    {uploadProgress[mobileActiveChat.conversationId]}%
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="border-t bg-white p-3 pb-safe">
                        {isRecording === mobileActiveChat.conversationId ? (
                            // Recording UI
                            <div className="flex items-center gap-3 px-2">
                                <div 
                                    className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center transition-transform"
                                    style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
                                >
                                    <Mic size={24} className="text-white" />
                                </div>
                                <span className="text-red-500 font-semibold text-lg">{formatTime(recordingTime)}</span>
                                <div className="flex-1 h-6 flex items-center gap-1">
                                    {Array.from({ length: 25 }).map((_, i) => (
                                        <div 
                                            key={i}
                                            className="w-1.5 bg-red-400 rounded-full transition-all"
                                            style={{ 
                                                height: `${Math.max(6, Math.random() * 24 * audioLevel)}px`
                                            }}
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={stopRecording}
                                    className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 active:bg-red-700 touch-target"
                                >
                                    <MicOff size={24} />
                                </button>
                            </div>
                        ) : (
                            // Normal input
                            <div className="flex items-center gap-2">
                                {/* Emoji */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowEmojiPicker(
                                            showEmojiPicker === mobileActiveChat.conversationId ? null : mobileActiveChat.conversationId
                                        )}
                                        className="p-2.5 text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-full touch-target"
                                    >
                                        <Smile size={24} />
                                    </button>
                                    {showEmojiPicker === mobileActiveChat.conversationId && (
                                        <div className="absolute bottom-14 left-0 bg-white border rounded-xl shadow-lg p-3 w-72 z-50 max-h-64 overflow-y-auto">
                                            {emojiCategories.map(cat => (
                                                <div key={cat.name} className="mb-3">
                                                    <p className="text-xs text-gray-500 mb-2 font-medium">{cat.name}</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {cat.emojis.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => {
                                                                    setMessageInputs(prev => ({
                                                                        ...prev,
                                                                        [mobileActiveChat.conversationId]: (prev[mobileActiveChat.conversationId] || '') + emoji
                                                                    }));
                                                                    setShowEmojiPicker(null);
                                                                }}
                                                                className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-lg text-xl"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* File input */}
                                <input
                                    type="file"
                                    ref={el => { fileInputRefs.current[mobileActiveChat.conversationId] = el; }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            handleFileUpload(mobileActiveChat.conversationId, file);
                                            e.target.value = '';
                                        }
                                    }}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRefs.current[mobileActiveChat.conversationId]?.click()}
                                    className="p-2.5 text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-full touch-target"
                                >
                                    <Paperclip size={24} />
                                </button>

                                {/* Image input */}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    ref={el => { fileInputRefs.current[mobileActiveChat.conversationId + 1000] = el; }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            handleFileUpload(mobileActiveChat.conversationId, file);
                                            e.target.value = '';
                                        }
                                    }}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRefs.current[mobileActiveChat.conversationId + 1000]?.click()}
                                    className="p-2.5 text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-full touch-target"
                                >
                                    <Image size={24} />
                                </button>

                                {/* Text input */}
                                <input
                                    type="text"
                                    value={messageInputs[mobileActiveChat.conversationId] || ''}
                                    onChange={(e) => setMessageInputs(prev => ({
                                        ...prev,
                                        [mobileActiveChat.conversationId]: e.target.value
                                    }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage(mobileActiveChat.conversationId);
                                        }
                                    }}
                                    placeholder="Nhập tin nhắn..."
                                    className="flex-1 px-4 py-3 border rounded-full text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />

                                {/* Voice/Send button */}
                                {messageInputs[mobileActiveChat.conversationId]?.trim() ? (
                                    <button
                                        onClick={() => sendMessage(mobileActiveChat.conversationId)}
                                        className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 active:bg-blue-700 touch-target"
                                    >
                                        <Send size={24} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => startRecording(mobileActiveChat.conversationId)}
                                        className="p-2.5 text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-full touch-target"
                                    >
                                        <Mic size={24} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Desktop Chat Windows */}
            {!isMobile && chatWindows.map((window, index) => (
                <div
                    key={window.id}
                    className={`fixed bottom-0 bg-white rounded-t-lg shadow-2xl z-50 overflow-hidden border border-gray-200 transition-all ${
                        window.isMinimized ? 'h-12' : 'h-96'
                    }`}
                    style={{
                        width: '320px',
                        right: `${100 + index * 340}px`
                    }}
                >
                    {/* Window Header */}
                    <div 
                        className="bg-blue-600 text-white px-3 py-2 flex items-center justify-between cursor-pointer"
                        onClick={() => toggleMinimize(window.id)}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {window.conversation.displayAvatar ? (
                                    <img src={window.conversation.displayAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm font-medium">
                                        {window.conversation.displayName.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <span className="font-medium truncate">{window.conversation.displayName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={(e) => { e.stopPropagation(); toggleMinimize(window.id); }}
                                className="p-1 hover:bg-blue-500 rounded"
                            >
                                {window.isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); closeWindow(window.id); }}
                                className="p-1 hover:bg-blue-500 rounded"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Window Content */}
                    {!window.isMinimized && (
                        <>
                            {/* Messages */}
                            <div className="h-[calc(100%-96px)] overflow-y-auto p-3 space-y-2 bg-gray-50">
                                {window.messages.map(msg => {
                                    const isOwn = msg.sender.id === user?.id;
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[80%] ${isOwn ? 'order-2' : 'order-1'}`}>
                                                {!isOwn && (
                                                    <p className="text-xs text-gray-500 mb-1">{msg.sender.name}</p>
                                                )}
                                                <div className={`rounded-lg px-3 py-2 ${
                                                    isOwn 
                                                        ? 'bg-blue-500 text-white' 
                                                        : 'bg-white border border-gray-200'
                                                }`}>
                                                    {renderMessageContent(msg)}
                                                </div>
                                                <p className={`text-xs text-gray-400 mt-1 ${isOwn ? 'text-right' : ''}`}>
                                                    {formatMessageTime(msg.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Upload progress */}
                            {uploadProgress[window.conversationId] !== undefined && (
                                <div className="px-3 py-1 bg-gray-100 border-t">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1 bg-gray-300 rounded">
                                            <div 
                                                className="h-full bg-blue-500 rounded transition-all" 
                                                style={{ width: `${uploadProgress[window.conversationId]}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {uploadProgress[window.conversationId]}%
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Input Area */}
                            <div className="border-t bg-white p-2">
                                {isRecording === window.conversationId ? (
                                    // Recording UI
                                    <div className="flex items-center gap-2 px-2">
                                        <div 
                                            className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center"
                                            style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
                                        >
                                            <Mic size={16} className="text-white" />
                                        </div>
                                        <span className="text-red-500 font-medium">{formatTime(recordingTime)}</span>
                                        <div className="flex-1 h-4 flex items-center gap-0.5">
                                            {Array.from({ length: 20 }).map((_, i) => (
                                                <div 
                                                    key={i}
                                                    className="w-1 bg-red-400 rounded-full transition-all"
                                                    style={{ 
                                                        height: `${Math.max(4, Math.random() * 16 * audioLevel)}px`
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <button
                                            onClick={stopRecording}
                                            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                                        >
                                            <MicOff size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    // Normal input
                                    <div className="flex items-center gap-1">
                                        {/* Emoji */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowEmojiPicker(
                                                    showEmojiPicker === window.conversationId ? null : window.conversationId
                                                )}
                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                            >
                                                <Smile size={18} />
                                            </button>
                                            {showEmojiPicker === window.conversationId && (
                                                <div className="absolute bottom-10 left-0 bg-white border rounded-lg shadow-lg p-2 w-64 z-50">
                                                    {emojiCategories.map(cat => (
                                                        <div key={cat.name} className="mb-2">
                                                            <p className="text-xs text-gray-500 mb-1">{cat.name}</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {cat.emojis.map(emoji => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => {
                                                                            setMessageInputs(prev => ({
                                                                                ...prev,
                                                                                [window.conversationId]: (prev[window.conversationId] || '') + emoji
                                                                            }));
                                                                            setShowEmojiPicker(null);
                                                                        }}
                                                                        className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* File input */}
                                        <input
                                            type="file"
                                            ref={el => { fileInputRefs.current[window.conversationId] = el; }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    handleFileUpload(window.conversationId, file);
                                                    e.target.value = '';
                                                }
                                            }}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRefs.current[window.conversationId]?.click()}
                                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                        >
                                            <Paperclip size={18} />
                                        </button>

                                        {/* Image input */}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            ref={el => { fileInputRefs.current[window.conversationId + 1000] = el; }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    handleFileUpload(window.conversationId, file);
                                                    e.target.value = '';
                                                }
                                            }}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRefs.current[window.conversationId + 1000]?.click()}
                                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                        >
                                            <Image size={18} />
                                        </button>

                                        {/* Text input */}
                                        <input
                                            type="text"
                                            value={messageInputs[window.conversationId] || ''}
                                            onChange={(e) => setMessageInputs(prev => ({
                                                ...prev,
                                                [window.conversationId]: e.target.value
                                            }))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendMessage(window.conversationId);
                                                }
                                            }}
                                            placeholder="Aa"
                                            className="flex-1 px-3 py-1.5 border rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />

                                        {/* Voice/Send button */}
                                        {messageInputs[window.conversationId]?.trim() ? (
                                            <button
                                                onClick={() => sendMessage(window.conversationId)}
                                                className="p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                                            >
                                                <Send size={18} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => startRecording(window.conversationId)}
                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                            >
                                                <Mic size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            ))}
        </>
    );
};

export default ChatPopup;
