import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import api from '../config/api';
import {
    Send,
    Image,
    Paperclip,
    Users,
    Plus,
    X,
    Search,
    MoreVertical,
    Check,
    ArrowLeft,
    User as UserCircle
} from 'lucide-react';
import { resolveUrl } from '../utils/urlUtils';

interface User {
    id: number;
    name: string;
    username: string;
    avatar: string | null;
    avatarUrl?: string | null;
    position?: string;
}

interface Conversation {
    id: number;
    name: string | null;
    type: 'PRIVATE' | 'GROUP';
    avatar: string | null;
    avatarUrl?: string | null;
    displayName: string;
    displayAvatar: string | null;
    unreadCount: number;
    members: {
        userId: number;
        user: User;
        isAdmin: boolean;
    }[];
    lastMessage: Message | null;
    createdAt: string;
    updatedAt: string;
}

interface Message {
    id: number;
    content: string | null;
    messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'TEXT_WITH_FILE';
    attachment: string | null;
    attachmentUrl?: string | null;
    senderId: number;
    sender: User;
    createdAt: string;
}

export default function CompanyChat() {
    const { user, token } = useAuth();
    const { socketRef, connected } = useWebSocket(token);

    // State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typingUsers, setTypingUsers] = useState<{ [key: number]: string }>({});
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    const [showConversationList, setShowConversationList] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Responsive handler
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobileView(mobile);
            if (!mobile) {
                setShowConversationList(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch conversations
    const fetchConversations = useCallback(async () => {
        try {
            const response = await api.get('/chat/conversations');
            setConversations(response.data);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Fetch messages when conversation selected
    useEffect(() => {
        if (!selectedConversation) return;

        const fetchMessages = async () => {
            setLoadingMessages(true);
            try {
                const response = await api.get(`/chat/conversations/${selectedConversation.id}/messages`);
                setMessages(response.data.messages);
            } catch (error) {
                console.error('Error fetching messages:', error);
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchMessages();

        // Join socket room
        if (socketRef.current && connected) {
            socketRef.current.emit('join_conversation', String(selectedConversation.id));
        }

        return () => {
            if (socketRef.current && connected && selectedConversation) {
                socketRef.current.emit('leave_conversation', String(selectedConversation.id));
            }
        };
    }, [selectedConversation, socketRef, connected]);

    // Socket event listeners
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !connected) return;

        const handleNewMessage = (data: { conversationId: number; message: Message }) => {
            if (selectedConversation?.id === data.conversationId) {
                setMessages(prev => [...prev, data.message]);
                scrollToBottom();
            }

            // Update conversation list
            setConversations(prev => {
                const updated = prev.map(conv => {
                    if (conv.id === data.conversationId) {
                        return {
                            ...conv,
                            lastMessage: data.message,
                            unreadCount: selectedConversation?.id === data.conversationId
                                ? 0
                                : conv.unreadCount + 1
                        };
                    }
                    return conv;
                });
                // Sort by latest message
                return updated.sort((a, b) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                );
            });
        };

        const handleTyping = (data: { conversationId: number; userId: number; userName: string }) => {
            if (selectedConversation?.id === data.conversationId && data.userId !== user?.id) {
                setTypingUsers(prev => ({ ...prev, [data.userId]: data.userName }));
            }
        };

        const handleStopTyping = (data: { conversationId: number; userId: number }) => {
            setTypingUsers(prev => {
                const updated = { ...prev };
                delete updated[data.userId];
                return updated;
            });
        };

        socket.on('new_chat_message', handleNewMessage);
        socket.on('chat_user_typing', handleTyping);
        socket.on('chat_user_stop_typing', handleStopTyping);

        return () => {
            socket.off('new_chat_message', handleNewMessage);
            socket.off('chat_user_typing', handleTyping);
            socket.off('chat_user_stop_typing', handleStopTyping);
        };
    }, [socketRef, connected, selectedConversation, user]);

    // Auto scroll to bottom
    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle typing
    const handleTyping = () => {
        const socket = socketRef.current;
        if (!socket || !selectedConversation) return;

        socket.emit('chat_typing', {
            conversationId: selectedConversation.id,
            userName: user?.name || 'Unknown'
        });

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('chat_stop_typing', {
                conversationId: selectedConversation.id
            });
        }, 2000);
    };

    // Send message
    const sendMessage = async () => {
        if (!inputMessage.trim() || !selectedConversation) return;

        try {
            const response = await api.post(
                `/chat/conversations/${selectedConversation.id}/messages`,
                { content: inputMessage.trim() }
            );

            // Emit to socket
            const socket = socketRef.current;
            if (socket && connected) {
                socket.emit('send_chat_message', {
                    conversationId: selectedConversation.id,
                    message: response.data
                });
            }

            setInputMessage('');

            // Stop typing
            if (socket) {
                socket.emit('chat_stop_typing', {
                    conversationId: selectedConversation.id
                });
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // Send file
    const sendFile = async (file: File) => {
        if (!selectedConversation) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Don't set Content-Type manually - browser will set it with proper boundary
            const response = await api.post(
                `/chat/conversations/${selectedConversation.id}/messages/file`,
                formData
            );

            const socket = socketRef.current;
            if (socket && connected) {
                socket.emit('send_chat_message', {
                    conversationId: selectedConversation.id,
                    message: response.data
                });
            }
        } catch (error) {
            console.error('Error sending file:', error);
        }
    };

    // Select conversation
    const handleSelectConversation = (conv: Conversation) => {
        setSelectedConversation(conv);
        setMessages([]);
        if (isMobileView) {
            setShowConversationList(false);
        }
        // Reset unread count
        setConversations(prev => prev.map(c =>
            c.id === conv.id ? { ...c, unreadCount: 0 } : c
        ));
    };

    // Format time
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Hôm qua';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('vi-VN', { weekday: 'short' });
        }
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    // Typing indicator text
    const typingText = Object.keys(typingUsers).length > 0
        ? `${Object.values(typingUsers).join(', ')} đang nhập...`
        : null;

    // Filter conversations
    const filteredConversations = conversations.filter(conv => {
        if (!searchQuery) return true;
        const displayName = conv.displayName || conv.name || '';
        return displayName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div style={{ height: 'calc(100dvh - 56px - env(safe-area-inset-top, 0px))' }} className="flex bg-gray-50 md:h-[calc(100dvh-64px)]">
            {/* Conversation List */}
            <div className={`
                ${isMobileView ? 'fixed inset-0 z-[45] pt-[calc(56px+env(safe-area-inset-top,0px))] md:pt-[64px]' : 'w-80 border-r'}
                ${isMobileView && !showConversationList ? 'hidden' : ''}
                bg-white flex flex-col
            `}>
                {/* Header */}
                <div className="p-2 md:p-4 border-b">
                    <div className="flex items-center justify-between mb-2 md:mb-4">
                        <h2 className="text-lg md:text-xl font-bold text-gray-800">Tin nhắn</h2>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="p-1.5 md:p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                        >
                            <Plus className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm cuộc trò chuyện..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Conversation Items */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-500">Đang tải...</div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            {searchQuery ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện nào'}
                        </div>
                    ) : (
                        filteredConversations.map(conv => (
                            <div
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv)}
                                className={`
                                    p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 border-b
                                    ${selectedConversation?.id === conv.id ? 'bg-blue-50' : ''}
                                `}
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    {(conv.avatarUrl || conv.displayAvatar) ? (
                                        <img
                                            src={resolveUrl(conv.avatarUrl || conv.displayAvatar) || ''}
                                            alt={conv.displayName}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : conv.type === 'GROUP' ? (
                                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Users className="h-6 w-6 text-blue-500" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                            <UserCircle className="h-8 w-8 text-gray-500" />
                                        </div>
                                    )}
                                    {conv.unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium text-gray-900 truncate">
                                            {conv.displayName}
                                        </h3>
                                        <span className="text-xs text-gray-500">
                                            {conv.lastMessage && formatTime(conv.lastMessage.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 truncate">
                                        {conv.lastMessage ? (
                                            conv.lastMessage.messageType === 'IMAGE' ? '📷 Hình ảnh' :
                                                conv.lastMessage.messageType === 'FILE' ? '📎 Tệp đính kèm' :
                                                    conv.lastMessage.messageType === 'VOICE' ? '🎤 Tin nhắn thoại' :
                                                        conv.lastMessage.content
                                        ) : 'Chưa có tin nhắn'}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`
                flex-1 flex flex-col bg-white
                ${isMobileView && showConversationList ? 'hidden' : ''}
            `}>
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-2 md:p-4 border-b flex items-center gap-2 md:gap-3">
                            {isMobileView && (
                                <button
                                    onClick={() => setShowConversationList(true)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    <ArrowLeft className="h-6 w-6" />
                                </button>
                            )}

                            {(selectedConversation.avatarUrl || selectedConversation.displayAvatar) ? (
                                <img
                                    src={resolveUrl(selectedConversation.avatarUrl || selectedConversation.displayAvatar) || ''}
                                    alt={selectedConversation.displayName}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : selectedConversation.type === 'GROUP' ? (
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-blue-500" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                    <UserCircle className="h-6 w-6 text-gray-500" />
                                </div>
                            )}

                            <div className="flex-1">
                                <h3 className="font-medium text-gray-900">
                                    {selectedConversation.displayName}
                                </h3>
                                {selectedConversation.type === 'GROUP' && (
                                    <p className="text-sm text-gray-500">
                                        {selectedConversation.members.length} thành viên
                                    </p>
                                )}
                            </div>

                            <button className="p-2 hover:bg-gray-100 rounded-full">
                                <MoreVertical className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loadingMessages ? (
                                <div className="text-center text-gray-500">Đang tải tin nhắn...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-gray-500">
                                    Hãy bắt đầu cuộc trò chuyện!
                                </div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const isMe = msg.senderId === user?.id;
                                    const showAvatar = idx === 0 ||
                                        messages[idx - 1].senderId !== msg.senderId;

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`flex gap-2 max-w-[70%] ${isMe ? 'flex-row-reverse' : ''}`}>
                                                {!isMe && showAvatar && (
                                                    msg.sender.avatarUrl ? (
                                                        <img
                                                            src={resolveUrl(msg.sender.avatarUrl) || ''}
                                                            alt={msg.sender.name}
                                                            className="w-8 h-8 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                                            <UserCircle className="h-5 w-5 text-gray-500" />
                                                        </div>
                                                    )
                                                )}
                                                {!isMe && !showAvatar && <div className="w-8" />}

                                                <div>
                                                    {!isMe && showAvatar && selectedConversation.type === 'GROUP' && (
                                                        <p className="text-xs text-gray-500 mb-1 ml-1">
                                                            {msg.sender.name}
                                                        </p>
                                                    )}

                                                    <div className={`
                                                        px-4 py-2 rounded-2xl
                                                        ${isMe
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-gray-100 text-gray-800'
                                                        }
                                                    `}>
                                                        {/* Text content */}
                                                        {msg.content && (
                                                            <p className="whitespace-pre-wrap break-words">
                                                                {msg.content}
                                                            </p>
                                                        )}

                                                        {/* Image */}
                                                        {msg.messageType === 'IMAGE' && msg.attachmentUrl && (
                                                            <img
                                                                src={resolveUrl(msg.attachmentUrl) || ''}
                                                                alt="Image"
                                                                className="max-w-full rounded-lg cursor-pointer"
                                                                onClick={() => window.open(resolveUrl(msg.attachmentUrl)!, '_blank')}
                                                            />
                                                        )}

                                                        {/* Video file detection */}
                                                        {(msg.messageType === 'FILE' || msg.messageType === 'TEXT_WITH_FILE') && msg.attachmentUrl && (() => {
                                                            const fname = msg.attachment?.split('/').pop() || msg.attachmentUrl?.split('/').pop() || '';
                                                            const ext = fname.split('.').pop()?.toLowerCase() || '';
                                                            const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', '3gp'];
                                                            if (videoExts.includes(ext)) {
                                                                const mimeMap: Record<string, string> = {
                                                                    'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg',
                                                                    'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
                                                                    'mkv': 'video/x-matroska', 'm4v': 'video/x-m4v', '3gp': 'video/3gpp'
                                                                };
                                                                return (
                                                                    <video
                                                                        controls
                                                                        playsInline
                                                                        className="max-w-full rounded-lg"
                                                                        style={{ maxHeight: '300px' }}
                                                                        preload="metadata"
                                                                    >
                                                                        <source src={resolveUrl(msg.attachmentUrl) || ''} type={mimeMap[ext] || `video/${ext}`} />
                                                                        Trình duyệt không hỗ trợ video.
                                                                    </video>
                                                                );
                                                            }
                                                            return null;
                                                        })()}

                                                        {/* File (non-video) */}
                                                        {msg.messageType === 'FILE' && msg.attachmentUrl && (() => {
                                                            const fname = msg.attachment?.split('/').pop() || msg.attachmentUrl?.split('/').pop() || '';
                                                            const ext = fname.split('.').pop()?.toLowerCase() || '';
                                                            const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', '3gp'];
                                                            if (videoExts.includes(ext)) return null; // Already rendered as video above
                                                            return (
                                                                <a
                                                                    href={resolveUrl(msg.attachmentUrl) || ''}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`flex items-center gap-2 ${isMe ? 'text-white' : 'text-blue-500'}`}
                                                                >
                                                                    <Paperclip className="h-4 w-4" />
                                                                    <span className="underline">Tải xuống tệp</span>
                                                                </a>
                                                            );
                                                        })()}

                                                        {/* Voice */}
                                                        {msg.messageType === 'VOICE' && msg.attachmentUrl && (
                                                            <audio controls className="max-w-full">
                                                                <source src={resolveUrl(msg.attachmentUrl) || ''} type="audio/webm" />
                                                            </audio>
                                                        )}
                                                    </div>

                                                    <p className={`text-xs text-gray-400 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                                                        {formatTime(msg.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Typing indicator */}
                            {typingText && (
                                <div className="text-sm text-gray-500 italic">
                                    {typingText}
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-2 md:p-4 border-t" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}>
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            sendFile(e.target.files[0]);
                                            e.target.value = '';
                                        }
                                    }}
                                />

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                                >
                                    <Paperclip className="h-5 w-5" />
                                </button>

                                <button
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'image/*';
                                        input.onchange = (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (file) sendFile(file);
                                        };
                                        input.click();
                                    }}
                                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                                >
                                    <Image className="h-5 w-5" />
                                </button>

                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => {
                                        setInputMessage(e.target.value);
                                        handleTyping();
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                    placeholder="Nhập tin nhắn..."
                                    className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />

                                <button
                                    onClick={sendMessage}
                                    disabled={!inputMessage.trim()}
                                    className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg">Chọn một cuộc trò chuyện để bắt đầu</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Tạo cuộc trò chuyện mới
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Conversation Modal */}
            {showCreateModal && (
                <CreateConversationModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(conv) => {
                        setConversations(prev => [conv, ...prev]);
                        setSelectedConversation(conv);
                        setShowCreateModal(false);
                        if (isMobileView) {
                            setShowConversationList(false);
                        }
                    }}
                />
            )}
        </div>
    );
}

// Modal tạo cuộc trò chuyện mới
interface CreateConversationModalProps {
    onClose: () => void;
    onCreated: (conversation: Conversation) => void;
}

function CreateConversationModal({ onClose, onCreated }: CreateConversationModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    // Search users
    useEffect(() => {
        if (!searchQuery.trim()) {
            setUsers([]);
            return;
        }

        const searchUsers = async () => {
            setSearchLoading(true);
            try {
                const response = await api.get('/chat/users/search', {
                    params: { q: searchQuery }
                });
                setUsers(response.data);
            } catch (error) {
                console.error('Error searching users:', error);
            } finally {
                setSearchLoading(false);
            }
        };

        const debounce = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    // Toggle user selection
    const toggleUser = (user: User) => {
        setSelectedUsers(prev => {
            const exists = prev.find(u => u.id === user.id);
            if (exists) {
                return prev.filter(u => u.id !== user.id);
            }
            return [...prev, user];
        });
    };

    // Create conversation
    const handleCreate = async () => {
        if (selectedUsers.length === 0) return;

        setLoading(true);
        try {
            const response = await api.post('/chat/conversations', {
                memberIds: selectedUsers.map(u => u.id),
                type: selectedUsers.length > 1 ? 'GROUP' : 'PRIVATE',
                name: selectedUsers.length > 1 ? groupName : null
            });
            onCreated(response.data);
        } catch (error) {
            console.error('Error creating conversation:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-lg font-bold">Tạo cuộc trò chuyện mới</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Group name (only if multiple users selected) */}
                    {selectedUsers.length > 1 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tên nhóm
                            </label>
                            <input
                                type="text"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder="Nhập tên nhóm..."
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Selected users */}
                    {selectedUsers.length > 0 && (
                        <div className="mb-4">
                            <p className="text-sm text-gray-500 mb-2">
                                Đã chọn ({selectedUsers.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {selectedUsers.map(u => (
                                    <span
                                        key={u.id}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                                    >
                                        {u.name}
                                        <button
                                            onClick={() => toggleUser(u)}
                                            className="hover:bg-blue-200 rounded-full p-0.5"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search input */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm người dùng..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* User list */}
                    <div className="space-y-2">
                        {searchLoading ? (
                            <p className="text-center text-gray-500 py-4">Đang tìm kiếm...</p>
                        ) : users.length === 0 ? (
                            searchQuery ? (
                                <p className="text-center text-gray-500 py-4">Không tìm thấy người dùng</p>
                            ) : (
                                <p className="text-center text-gray-500 py-4">Nhập tên để tìm kiếm</p>
                            )
                        ) : (
                            users.map(u => {
                                const isSelected = selectedUsers.some(su => su.id === u.id);
                                return (
                                    <div
                                        key={u.id}
                                        onClick={() => toggleUser(u)}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-lg cursor-pointer
                                            ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}
                                        `}
                                    >
                                        {u.avatarUrl ? (
                                            <img
                                                src={resolveUrl(u.avatarUrl) || ''}
                                                alt={u.name}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                <UserCircle className="h-6 w-6 text-gray-500" />
                                            </div>
                                        )}

                                        <div className="flex-1">
                                            <p className="font-medium">{u.name}</p>
                                            {u.position && (
                                                <p className="text-sm text-gray-500">{u.position}</p>
                                            )}
                                        </div>

                                        {isSelected && (
                                            <Check className="h-5 w-5 text-blue-500" />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t">
                    <button
                        onClick={handleCreate}
                        disabled={selectedUsers.length === 0 || loading}
                        className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Đang tạo...' :
                            selectedUsers.length > 1 ? 'Tạo nhóm chat' : 'Bắt đầu trò chuyện'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
