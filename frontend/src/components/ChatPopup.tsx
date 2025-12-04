import React, { useState, useEffect, useRef } from 'react';
import {
    MessageCircle, X, Search, Users, MessageSquare, Send, Smile, Paperclip,
    Mic, Minimize2, Maximize2, ArrowLeft, Play, Pause,
    Volume2, FileText, Download, Eye, Plus, Check, Loader2, Camera
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { API_URL } from '../config/api';
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

interface Reaction {
    id: number;
    emoji: string;
    userId: number;
    user: {
        id: number;
        name: string;
    };
}

interface Message {
    id: number;
    content: string | null;
    messageType: 'TEXT' | 'VOICE' | 'FILE' | 'IMAGE' | 'TEXT_WITH_FILE';
    attachment: string | null;
    attachmentUrl: string | null;
    attachmentName?: string | null;
    conversationId?: number;
    senderId?: number;
    createdAt: string;
    updatedAt?: string;
    reactions?: Reaction[];
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
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

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
    const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
    
    // Typing state
    const [typingUsers, setTypingUsers] = useState<Record<number, { userName: string; userId: number }[]>>({});
    const typingTimeoutRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
    const typingEmitTimeoutRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
    
    // Long press state for mobile
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [longPressMessageId, setLongPressMessageId] = useState<number | null>(null);
    
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

    // Polling for active conversations to ensure realtime updates
    useEffect(() => {
        if (chatWindows.length === 0 && !mobileActiveChat) return;

        // Poll every 3 seconds for new messages in active conversations
        const pollMessages = async () => {
            const activeConvIds = [
                ...chatWindows.map(w => w.conversationId),
                mobileActiveChat?.conversationId
            ].filter(Boolean) as number[];

            for (const convId of activeConvIds) {
                try {
                    const messages = await fetchMessages(convId);
                    
                    // Update chat windows
                    setChatWindows(prev => prev.map(w =>
                        w.conversationId === convId
                            ? { ...w, messages }
                            : w
                    ));

                    // Update mobile chat
                    if (mobileActiveChat?.conversationId === convId) {
                        setMobileActiveChat(prev => prev ? { ...prev, messages } : null);
                    }
                } catch (error) {
                    // Silently ignore polling errors
                }
            }
        };

        const interval = setInterval(pollMessages, 3000);
        return () => clearInterval(interval);
    }, [chatWindows.length, mobileActiveChat?.conversationId]);

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
            
            // Cleanup long press timer
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
            }
            
            // Cleanup typing emit timeouts
            Object.values(typingEmitTimeoutRef.current).forEach(timer => {
                clearTimeout(timer);
            });
            
            // Cleanup typing indicator timeouts
            Object.values(typingTimeoutRef.current).forEach(timer => {
                clearTimeout(timer);
            });
        };
    }, []);

    // WebSocket listeners for realtime updates
    useEffect(() => {
        if (!socketRef.current || !connected) return;

        // Listen for new messages
        const handleNewMessage = (data: { conversationId: number; message: Message }) => {
            // Skip if this is our own message (already added via optimistic update or API response)
            if (data.message.senderId === user?.id) {
                return;
            }
            
            // Update chat windows
            setChatWindows(prev => prev.map(w =>
                w.conversationId === data.conversationId
                    ? { ...w, messages: [...w.messages, data.message] }
                    : w
            ));

            // Update mobile chat - use functional update to avoid stale closure
            setMobileActiveChat(prev => {
                if (prev?.conversationId === data.conversationId) {
                    return { ...prev, messages: [...prev.messages, data.message] };
                }
                return prev;
            });

            // Refresh conversations list
            fetchConversations();
        };
        
        socketRef.current.on('chat:new_message', handleNewMessage);

        // Listen for typing indicator
        const handleTyping = (data: { conversationId: number; userName: string; userId: number }) => {
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
        };
        
        socketRef.current.on('chat:typing', handleTyping);

        // Listen for stop typing
        const handleStopTyping = (data: { conversationId: number; userId: number }) => {
            setTypingUsers(prev => {
                const current = prev[data.conversationId] || [];
                return {
                    ...prev,
                    [data.conversationId]: current.filter(u => u.userId !== data.userId)
                };
            });
        };
        
        socketRef.current.on('chat:stop_typing', handleStopTyping);

        // Listen for reaction added
        const handleReactionAdded = (data: { conversationId: number; messageId: number; reactions: Reaction[] }) => {
            const updateMessages = (messages: Message[]) =>
                messages.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m);

            setChatWindows(prev => prev.map(w =>
                w.conversationId === data.conversationId
                    ? { ...w, messages: updateMessages(w.messages) }
                    : w
            ));

            setMobileActiveChat(prev => {
                if (prev?.conversationId === data.conversationId) {
                    return { ...prev, messages: updateMessages(prev.messages) };
                }
                return prev;
            });
        };
        
        socketRef.current.on('chat:reaction_added', handleReactionAdded);

        // Listen for reaction removed
        const handleReactionRemoved = (data: { conversationId: number; messageId: number; reactions: Reaction[] }) => {
            const updateMessages = (messages: Message[]) =>
                messages.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m);

            setChatWindows(prev => prev.map(w =>
                w.conversationId === data.conversationId
                    ? { ...w, messages: updateMessages(w.messages) }
                    : w
            ));

            setMobileActiveChat(prev => {
                if (prev?.conversationId === data.conversationId) {
                    return { ...prev, messages: updateMessages(prev.messages) };
                }
                return prev;
            });
        };
        
        socketRef.current.on('chat:reaction_removed', handleReactionRemoved);

        // Listen for new conversation (when someone creates a chat with you)
        const handleNewConversation = (data: { conversation: Conversation }) => {
            setConversations(prev => {
                // Check if already exists
                if (prev.some(c => c.id === data.conversation.id)) {
                    return prev;
                }
                return [data.conversation, ...prev];
            });
        };
        
        socketRef.current.on('chat:new_conversation', handleNewConversation);

        // Listen for conversation updated (name, avatar changes)
        const handleConversationUpdated = (data: { conversation: Conversation }) => {
            setConversations(prev => prev.map(c =>
                c.id === data.conversation.id ? { ...c, ...data.conversation } : c
            ));
            
            // Update active chat windows
            setChatWindows(prev => prev.map(w =>
                w.conversationId === data.conversation.id
                    ? { ...w, conversation: { ...w.conversation, ...data.conversation } }
                    : w
            ));
            
            setMobileActiveChat(prev => {
                if (prev?.conversationId === data.conversation.id) {
                    return { ...prev, conversation: { ...prev.conversation, ...data.conversation } };
                }
                return prev;
            });
        };
        
        socketRef.current.on('chat:conversation_updated', handleConversationUpdated);

        return () => {
            socketRef.current?.off('chat:new_message', handleNewMessage);
            socketRef.current?.off('chat:typing', handleTyping);
            socketRef.current?.off('chat:stop_typing', handleStopTyping);
            socketRef.current?.off('chat:reaction_added', handleReactionAdded);
            socketRef.current?.off('chat:reaction_removed', handleReactionRemoved);
            socketRef.current?.off('chat:new_conversation', handleNewConversation);
            socketRef.current?.off('chat:conversation_updated', handleConversationUpdated);
        };
    }, [connected, socketRef, user?.id]); // Removed mobileActiveChat from dependencies

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
            const messages = Array.isArray(data) ? data : (data.messages || []);
            console.log('Fetched messages:', messages); // Debug log
            return messages;
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
            const description = (document.getElementById('group-description') as HTMLInputElement)?.value || '';
            const avatarFile = (window as any)._groupAvatarFile as File | null;
            
            let response;
            
            if (avatarFile) {
                // Send with FormData for avatar upload
                const formData = new FormData();
                formData.append('type', 'GROUP');
                formData.append('name', groupName.trim());
                formData.append('description', description);
                formData.append('memberIds', JSON.stringify(selectedMembers.map(m => m.id)));
                formData.append('avatar', avatarFile);
                
                response = await fetch(`${API_URL}/chat/conversations`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                if (!response.ok) throw new Error('Failed to create group');
                response = { data: await response.json() };
            } else {
                response = await api.post('/chat/conversations', {
                    type: 'GROUP',
                    name: groupName.trim(),
                    description,
                    memberIds: selectedMembers.map(m => m.id)
                });
            }
            
            const newConv: Conversation = {
                ...response.data,
                displayName: groupName,
                displayAvatar: response.data.avatarUrl || null,
                unreadCount: 0
            };
            
            setConversations(prev => [newConv, ...prev]);
            openConversation(newConv);
            setShowCreateGroup(false);
            setGroupName('');
            setSelectedMembers([]);
            (window as any)._groupAvatarFile = null;
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Không thể tạo nhóm. Vui lòng thử lại.');
        }
    };

    const openConversation = async (conversation: Conversation) => {
        const existingWindow = chatWindows.find(w => w.conversationId === conversation.id);
        
        if (existingWindow) {
            // Join room if not already joined
            if (socketRef.current?.connected) {
                socketRef.current.emit('join_conversation', String(conversation.id));
            }
            
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

        // Join conversation room for realtime updates
        if (socketRef.current?.connected) {
            socketRef.current.emit('join_conversation', String(conversation.id));
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
        const window = chatWindows.find(w => w.id === windowId);
        
        // Leave conversation room
        if (window && socketRef.current?.connected) {
            socketRef.current.emit('leave_conversation', String(window.conversationId));
        }
        
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
        
        // Debounce typing indicator emission to reduce WebSocket traffic
        if (typingEmitTimeoutRef.current[conversationId]) {
            clearTimeout(typingEmitTimeoutRef.current[conversationId]);
        }
        
        typingEmitTimeoutRef.current[conversationId] = setTimeout(() => {
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
        }, 300); // 300ms debounce
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

        // Optimistic update - Add message immediately
        const optimisticMessage: Message = {
            id: Date.now(), // Temporary ID
            content: content.trim(),
            messageType: 'TEXT',
            attachment: null,
            attachmentUrl: null,
            conversationId,
            senderId: user?.id || 0,
            sender: {
                id: user?.id || 0,
                name: user?.name || 'You',
                avatar: undefined
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Update UI immediately
        setChatWindows(prev => prev.map(w =>
            w.conversationId === conversationId
                ? { ...w, messages: [...w.messages, optimisticMessage] }
                : w
        ));

        if (mobileActiveChat?.conversationId === conversationId) {
            setMobileActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, optimisticMessage] } : null);
        }

        // Clear input immediately
        setMessageInputs(prev => ({ ...prev, [conversationId]: '' }));

        try {
            console.log('Sending message to:', `/chat/conversations/${conversationId}/messages`);
            console.log('Message payload:', { content: content.trim(), messageType: 'TEXT' });
            
            const response = await api.post(`/chat/conversations/${conversationId}/messages`, {
                content: content.trim(),
                messageType: 'TEXT'
            });

            console.log('Message sent successfully:', response.data);
            const realMessage = response.data;
            
            // Replace optimistic message with real one from server
            setChatWindows(prev => prev.map(w =>
                w.conversationId === conversationId
                    ? { ...w, messages: w.messages.map(m => m.id === optimisticMessage.id ? realMessage : m) }
                    : w
            ));

            if (mobileActiveChat?.conversationId === conversationId) {
                setMobileActiveChat(prev => prev ? { 
                    ...prev, 
                    messages: prev.messages.map(m => m.id === optimisticMessage.id ? realMessage : m)
                } : null);
            }

            fetchConversations();
        } catch (error) {
            console.error('Error sending message:', error);
            // Remove optimistic message on error
            setChatWindows(prev => prev.map(w =>
                w.conversationId === conversationId
                    ? { ...w, messages: w.messages.filter(m => m.id !== optimisticMessage.id) }
                    : w
            ));

            if (mobileActiveChat?.conversationId === conversationId) {
                setMobileActiveChat(prev => prev ? { 
                    ...prev, 
                    messages: prev.messages.filter(m => m.id !== optimisticMessage.id)
                } : null);
            }
            
            alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
        }
    };

    // Add reaction to message
    const addReaction = async (messageId: number, emoji: string) => {
        try {
            await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
            setShowReactionPicker(null);
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    };

    // Remove reaction from message
    const removeReaction = async (messageId: number, emoji: string) => {
        try {
            await api.delete(`/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
        } catch (error) {
            console.error('Error removing reaction:', error);
        }
    };

    // Toggle reaction (add if not exists, remove if exists)
    const toggleReaction = async (msg: Message, emoji: string) => {
        const existingReaction = msg.reactions?.find(r => r.emoji === emoji && r.userId === user?.id);
        if (existingReaction) {
            await removeReaction(msg.id, emoji);
        } else {
            await addReaction(msg.id, emoji);
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
            
            // Use XMLHttpRequest for upload progress tracking
            const token = localStorage.getItem('token');
            const response = await new Promise<any>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentCompleted = Math.round((e.loaded * 100) / e.total);
                        setUploadProgress(prev => ({ ...prev, [conversationId]: percentCompleted }));
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status}`));
                    }
                });
                
                xhr.addEventListener('error', () => reject(new Error('Upload failed')));
                xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
                
                xhr.open('POST', `${API_URL}/chat/conversations/${conversationId}/messages/file`);
                if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }
                xhr.send(formData);
            });
            
            const newMessage = response;
            
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
                
                // Upload voice message - use the correct endpoint with multer
                const formData = new FormData();
                formData.append('audio', audioBlob, 'voice.webm');

                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages/voice`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to send voice message');
                    }

                    const newMessage = await response.json();
                    
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
                const imageUrl = msg.attachmentUrl || msg.attachment;
                return imageUrl ? (
                    <img
                        src={imageUrl}
                        alt="Image"
                        className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ maxHeight: '200px', maxWidth: '250px' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setImagePreview(imageUrl);
                        }}
                        onError={(e) => {
                            console.error('Image load error:', imageUrl);
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                        }}
                    />
                ) : (
                    <p className="text-sm text-gray-500">Hình ảnh không khả dụng</p>
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
                                        const groupedReactions = msg.reactions?.reduce((acc, r) => {
                                            if (!acc[r.emoji]) acc[r.emoji] = [];
                                            acc[r.emoji].push(r);
                                            return acc;
                                        }, {} as Record<string, Reaction[]>) || {};
                                        
                                        return (
                                            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fadeIn group`}>
                                                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col relative`}>
                                                    {!isOwn && (
                                                        <p className="text-xs text-gray-500 mb-1 ml-3 font-medium">{msg.sender.name}</p>
                                                    )}
                                                    <div className="relative">
                                                        <div className={`px-4 py-2.5 rounded-2xl shadow-sm transition-all hover:shadow-md ${
                                                            isOwn 
                                                                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm' 
                                                                : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                                                        }`}>
                                                            {renderMessage(msg, isOwn)}
                                                        </div>
                                                        
                                                        {/* Quick Reaction Bar - Show on hover for desktop */}
                                                        <div className={`absolute ${isOwn ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200`}>
                                                            <div className="bg-white rounded-full shadow-lg border border-gray-200 px-1.5 py-1 flex items-center gap-0.5">
                                                                {REACTION_EMOJIS.slice(0, 3).map(emoji => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => toggleReaction(msg, emoji)}
                                                                        className={`text-sm hover:scale-125 transition-transform p-1 rounded-full hover:bg-gray-100 ${
                                                                            msg.reactions?.some(r => r.emoji === emoji && r.userId === user?.id) ? 'bg-blue-100' : ''
                                                                        }`}
                                                                        title={emoji}
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                                <button
                                                                    onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                                                                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
                                                                    title="Thêm cảm xúc"
                                                                >
                                                                    <Smile size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Full Reaction Picker - Desktop */}
                                                        {showReactionPicker === msg.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowReactionPicker(null)} />
                                                                <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-12 bg-white rounded-full shadow-xl border border-gray-200 px-2 py-1 flex items-center gap-1 z-[9999] animate-slideDown`}>
                                                                    {REACTION_EMOJIS.map(emoji => (
                                                                        <button
                                                                            key={emoji}
                                                                            onClick={() => {
                                                                                toggleReaction(msg, emoji);
                                                                                setShowReactionPicker(null);
                                                                            }}
                                                                            className={`text-lg hover:scale-125 transition-transform p-1 rounded-full hover:bg-gray-100 ${
                                                                                msg.reactions?.some(r => r.emoji === emoji && r.userId === user?.id) ? 'bg-blue-100' : ''
                                                                            }`}
                                                                        >
                                                                            {emoji}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Display Reactions - Compact inline style */}
                                                    {Object.keys(groupedReactions).length > 0 && (
                                                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end mr-1' : 'ml-1'}`}>
                                                            {Object.entries(groupedReactions).map(([emoji, reactions]) => (
                                                                <button
                                                                    key={emoji}
                                                                    onClick={() => toggleReaction(msg, emoji)}
                                                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all ${
                                                                        reactions.some(r => r.userId === user?.id) 
                                                                            ? 'bg-blue-100 border border-blue-200' 
                                                                            : 'bg-gray-100 border border-gray-200 hover:bg-gray-200'
                                                                    }`}
                                                                    title={reactions.map(r => r.user.name).join(', ')}
                                                                >
                                                                    <span className="text-sm">{emoji}</span>
                                                                    {reactions.length > 1 && <span className="text-gray-600 text-[10px] font-medium">{reactions.length}</span>}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    <p className={`text-xs mt-0.5 text-gray-400 ${isOwn ? 'text-right mr-2' : 'ml-3'}`}>
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
                                                <p className="text-xs text-blue-600 mb-1 ml-3 font-medium italic">
                                                    {typingUsers[conversationId].map(u => u.userName).join(', ')} đang soạn tin nhắn...
                                                </p>
                                                <div className="px-4 py-2.5 rounded-2xl bg-gray-100 text-gray-800 rounded-bl-sm border border-gray-200">
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                                    {/* Nút hủy ghi âm */}
                                    <button 
                                        onClick={() => {
                                            if (mediaRecorderRef.current) {
                                                mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
                                                mediaRecorderRef.current = null;
                                            }
                                            if (recordingIntervalRef.current) {
                                                clearInterval(recordingIntervalRef.current);
                                            }
                                            audioChunksRef.current = [];
                                            setIsRecording(null);
                                            setRecordingTime(0);
                                            setAudioLevel(0);
                                        }} 
                                        className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors shrink-0"
                                        title="Hủy"
                                    >
                                        <X size={16} className="text-gray-600" />
                                    </button>
                                    {/* Nút gửi tin nhắn thoại */}
                                    <button 
                                        onClick={stopRecording} 
                                        className="p-1.5 bg-blue-500 hover:bg-blue-600 rounded-full transition-colors shrink-0"
                                        title="Gửi tin nhắn thoại"
                                    >
                                        <Send size={16} className="text-white" />
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
                                        title="Đính kèm file/ảnh/video"
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
        const isTyping = typingUsers[conversationId] && typingUsers[conversationId].length > 0;

        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col">
                {/* Header - Modern design with status */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white shrink-0 shadow-lg safe-area-top">
                    <button onClick={() => { setMobileActiveChat(null); setIsOpen(true); }} className="p-2 hover:bg-white/20 active:bg-white/30 rounded-lg transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden ring-2 ring-white/30">
                            {mobileActiveChat.conversation.displayAvatar ? (
                                <img src={mobileActiveChat.conversation.displayAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="font-semibold text-white">{mobileActiveChat.conversation.displayName.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-blue-600"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="font-semibold truncate block text-white">{mobileActiveChat.conversation.displayName}</span>
                        {isTyping ? (
                            <span className="text-xs text-blue-100 flex items-center gap-1">
                                <span className="inline-flex gap-0.5">
                                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </span>
                                đang soạn tin...
                            </span>
                        ) : (
                            <span className="text-xs text-blue-100">Đang hoạt động</span>
                        )}
                    </div>
                    <button onClick={() => closeWindow(mobileActiveChat.id)} className="p-2 hover:bg-white/20 active:bg-white/30 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {mobileActiveChat.messages.map(msg => {
                        const isOwn = msg.sender.id === user?.id;
                        const groupedReactions = msg.reactions?.reduce((acc, r) => {
                            if (!acc[r.emoji]) acc[r.emoji] = [];
                            acc[r.emoji].push(r);
                            return acc;
                        }, {} as Record<string, Reaction[]>) || {};
                        
                        return (
                            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div className="max-w-[80%]">
                                    {!isOwn && <p className="text-xs text-gray-500 mb-1 ml-2">{msg.sender.name}</p>}
                                    <div className="relative">
                                        {/* Long press for reactions on mobile */}
                                        <div 
                                            className={`px-3 py-2 rounded-2xl transition-all select-none ${
                                                isOwn ? 'bg-blue-500 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md border border-gray-100 shadow-sm'
                                            } ${longPressMessageId === msg.id ? 'scale-95 opacity-80' : ''}`}
                                            onTouchStart={(e) => {
                                                // Don't trigger long press if touching image or interactive element
                                                const target = e.target as HTMLElement;
                                                if (target.tagName === 'IMG' || target.tagName === 'BUTTON' || target.tagName === 'A') {
                                                    return;
                                                }
                                                // Start long press timer
                                                longPressTimerRef.current = setTimeout(() => {
                                                    setLongPressMessageId(msg.id);
                                                    setShowReactionPicker(msg.id);
                                                    // Vibrate if supported
                                                    if (navigator.vibrate) {
                                                        navigator.vibrate(50);
                                                    }
                                                }, 500);
                                            }}
                                            onTouchEnd={() => {
                                                // Cancel long press
                                                if (longPressTimerRef.current) {
                                                    clearTimeout(longPressTimerRef.current);
                                                    longPressTimerRef.current = null;
                                                }
                                                setLongPressMessageId(null);
                                            }}
                                            onTouchMove={() => {
                                                // Cancel if moved
                                                if (longPressTimerRef.current) {
                                                    clearTimeout(longPressTimerRef.current);
                                                    longPressTimerRef.current = null;
                                                }
                                                setLongPressMessageId(null);
                                            }}
                                        >
                                            {renderMessage(msg, isOwn)}
                                        </div>
                                        
                                        {/* Reaction Picker for Mobile - Show on long press */}
                                        {showReactionPicker === msg.id && (
                                            <>
                                                <div className="fixed inset-0 z-[9998] bg-black/10" onClick={() => setShowReactionPicker(null)} />
                                                <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-14 bg-white rounded-full shadow-2xl border border-gray-200 px-3 py-2 flex items-center gap-2 z-[9999] animate-slideUp`}>
                                                    {REACTION_EMOJIS.map((emoji, index) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                toggleReaction(msg, emoji); 
                                                                setShowReactionPicker(null);
                                                            }}
                                                            className={`text-2xl active:scale-150 transition-transform p-1.5 rounded-full active:bg-gray-100 ${
                                                                msg.reactions?.some(r => r.emoji === emoji && r.userId === user?.id) ? 'bg-blue-100 scale-110' : ''
                                                            }`}
                                                            style={{ animationDelay: `${index * 50}ms` }}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    
                                    {/* Display Reactions - Compact inline style */}
                                    {Object.keys(groupedReactions).length > 0 && (
                                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end mr-1' : 'ml-1'}`}>
                                            {Object.entries(groupedReactions).map(([emoji, reactions]) => (
                                                <button
                                                    key={emoji}
                                                    onClick={(e) => { e.stopPropagation(); toggleReaction(msg, emoji); }}
                                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all ${
                                                        reactions.some(r => r.userId === user?.id) 
                                                            ? 'bg-blue-100 border border-blue-200' 
                                                            : 'bg-gray-100 border border-gray-200 hover:bg-gray-200'
                                                    }`}
                                                    title={reactions.map(r => r.user.name).join(', ')}
                                                >
                                                    <span className="text-sm">{emoji}</span>
                                                    {reactions.length > 1 && <span className="text-gray-600 text-[10px] font-medium">{reactions.length}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <p className={`text-xs mt-0.5 text-gray-400 ${isOwn ? 'text-right' : ''}`}>
                                        {formatMessageTime(msg.createdAt)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Typing indicator for mobile - Improved */}
                    {typingUsers[conversationId] && typingUsers[conversationId].length > 0 && (
                        <div className="flex justify-start animate-fadeIn">
                            <div className="max-w-[80%]">
                                <p className="text-xs text-blue-600 mb-1 ml-2 italic font-medium">
                                    {typingUsers[conversationId].map(u => u.userName).join(', ')} đang soạn tin nhắn...
                                </p>
                                <div className="px-3 py-2 rounded-2xl bg-white text-gray-800 rounded-bl-md border border-gray-200 shadow-sm">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                <div className="p-3 border-t bg-white shrink-0 safe-area-bottom">
                    {isRecording === conversationId ? (
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div 
                                className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center animate-pulse"
                                style={{ transform: `scale(${1 + audioLevel * 0.2})` }}
                            >
                                <Mic size={24} className="text-white" />
                            </div>
                            <span className="text-lg font-medium text-red-600">{formatTime(recordingTime)}</span>
                            <div className="flex-1 flex items-center justify-center gap-0.5">
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-1 bg-red-400 rounded-full transition-all"
                                        style={{ height: `${Math.max(4, Math.random() * 20 * audioLevel)}px` }}
                                    />
                                ))}
                            </div>
                            {/* Nút hủy ghi âm */}
                            <button 
                                onClick={() => {
                                    if (mediaRecorderRef.current) {
                                        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
                                        mediaRecorderRef.current = null;
                                    }
                                    if (recordingIntervalRef.current) {
                                        clearInterval(recordingIntervalRef.current);
                                    }
                                    audioChunksRef.current = [];
                                    setIsRecording(null);
                                    setRecordingTime(0);
                                    setAudioLevel(0);
                                }} 
                                className="p-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-full transition-colors"
                                title="Hủy"
                            >
                                <X size={24} className="text-gray-600" />
                            </button>
                            {/* Nút gửi tin nhắn thoại */}
                            <button 
                                onClick={stopRecording} 
                                className="p-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-full transition-colors"
                                title="Gửi"
                            >
                                <Send size={24} className="text-white" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowEmojiPicker(showEmojiPicker === conversationId ? null : conversationId)}
                                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-full text-gray-500 transition-colors shrink-0"
                            >
                                <Smile size={20} />
                            </button>
                            <input
                                type="file"
                                id={`mobile-file-input-${conversationId}`}
                                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        handleFileUpload(conversationId, file);
                                        e.target.value = '';
                                    }
                                }}
                                className="hidden"
                            />
                            <input
                                type="file"
                                id={`mobile-camera-input-${conversationId}`}
                                accept="image/*"
                                capture="environment"
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
                                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-full text-gray-500 transition-colors shrink-0"
                                title="Đính kèm file/ảnh/video"
                            >
                                <Paperclip size={20} />
                            </button>
                            <button 
                                onClick={() => document.getElementById(`mobile-camera-input-${conversationId}`)?.click()} 
                                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-full text-gray-500 transition-colors shrink-0"
                                title="Chụp ảnh từ camera"
                            >
                                <Camera size={20} />
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
                                className="flex-1 px-3 py-2.5 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-w-0"
                            />
                            {/* Send Button - Always visible */}
                            <button
                                onClick={() => sendMessage(conversationId, messageInput)}
                                disabled={!messageInput.trim()}
                                className={`p-2.5 rounded-full transition-colors shrink-0 ${
                                    messageInput.trim() 
                                        ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white' 
                                        : 'bg-gray-200 text-gray-400'
                                }`}
                            >
                                <Send size={20} />
                            </button>
                            {/* Mic Button - Always visible */}
                            <button 
                                onClick={() => startRecording(conversationId)} 
                                className="p-2.5 hover:bg-gray-100 active:bg-gray-200 rounded-full text-gray-500 transition-colors shrink-0"
                                title="Ghi âm"
                            >
                                <Mic size={20} />
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
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl animate-scaleIn">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Users size={22} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Tạo nhóm mới</h3>
                                <p className="text-xs text-blue-100">Thêm thành viên để bắt đầu</p>
                            </div>
                        </div>
                        <button onClick={() => setShowCreateGroup(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-5 space-y-5 overflow-y-auto flex-1">
                        {/* Avatar Upload & Info */}
                        <div className="flex items-start gap-4">
                            <div className="relative">
                                <input
                                    type="file"
                                    id="group-avatar-input"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            // Store file for later upload
                                            (window as any)._groupAvatarFile = file;
                                            const url = URL.createObjectURL(file);
                                            (document.getElementById('group-avatar-preview') as HTMLImageElement).src = url;
                                            (document.getElementById('group-avatar-preview') as HTMLImageElement).classList.remove('hidden');
                                            (document.getElementById('group-avatar-placeholder') as HTMLElement).classList.add('hidden');
                                        }
                                    }}
                                />
                                <label
                                    htmlFor="group-avatar-input"
                                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-dashed border-blue-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:from-blue-50 hover:to-indigo-50 overflow-hidden transition-all relative group"
                                >
                                    <img id="group-avatar-preview" src="" alt="" className="w-full h-full object-cover hidden" />
                                    <div id="group-avatar-placeholder" className="flex flex-col items-center text-blue-400 group-hover:text-blue-500 transition-colors">
                                        <Camera size={28} />
                                        <span className="text-xs mt-1 font-medium">Ảnh nhóm</span>
                                    </div>
                                </label>
                            </div>
                            <div className="flex-1 space-y-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Tên nhóm <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder="Nhập tên nhóm..."
                                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1.5">Mô tả</label>
                                    <input
                                        type="text"
                                        id="group-description"
                                        placeholder="Mô tả về nhóm (tùy chọn)..."
                                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Members Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Thêm thành viên <span className="text-red-500">*</span>
                            </label>
                            <div className="relative mb-3">
                                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm người dùng..."
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                                />
                            </div>
                            
                            {/* Selected members chips */}
                            {selectedMembers.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {selectedMembers.map(m => (
                                        <span key={m.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                            <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                                                {m.name.charAt(0)}
                                            </span>
                                            {m.name}
                                            <button onClick={() => setSelectedMembers(prev => prev.filter(p => p.id !== m.id))} className="hover:text-blue-900 ml-0.5">
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            
                            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                                {allUsers.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">
                                        <Loader2 size={20} className="animate-spin mx-auto mb-2 text-gray-400" />
                                        Đang tải danh sách...
                                    </div>
                                ) : allUsers.map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => {
                                            if (selectedMembers.some(m => m.id === u.id)) {
                                                setSelectedMembers(prev => prev.filter(m => m.id !== u.id));
                                            } else {
                                                setSelectedMembers(prev => [...prev, u]);
                                            }
                                        }}
                                        className={`flex items-center gap-3 p-3 cursor-pointer transition-all ${
                                            selectedMembers.some(m => m.id === u.id) 
                                                ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                                                : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                                        }`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center overflow-hidden shadow-sm">
                                            {u.avatarUrl || u.avatar ? (
                                                <img src={u.avatarUrl || u.avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-sm font-semibold text-white">{u.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 truncate">{u.name}</p>
                                            <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                            selectedMembers.some(m => m.id === u.id)
                                                ? 'bg-blue-500 border-blue-500'
                                                : 'border-gray-300'
                                        }`}>
                                            {selectedMembers.some(m => m.id === u.id) && (
                                                <Check size={14} className="text-white" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {selectedMembers.length > 0 && (
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                    Đã chọn {selectedMembers.length} thành viên
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div className="p-4 border-t flex justify-end gap-2">
                        <button
                            onClick={() => {
                                setShowCreateGroup(false);
                                setGroupName('');
                                setSelectedMembers([]);
                                (window as any)._groupAvatarFile = null;
                            }}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={createGroupChat}
                            disabled={!groupName.trim() || selectedMembers.length === 0}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg shadow-blue-500/25"
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
                    <div className={`absolute ${isMobile ? 'fixed inset-0 z-50' : 'top-full right-0 mt-2 w-96'} bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col ${isMobile ? '' : 'max-h-[580px]'}`}>
                        {/* Header - Modern gradient */}
                        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shrink-0">
                            <div className="p-4 pb-3">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                            <MessageCircle size={22} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">Tin nhắn</h3>
                                            <p className="text-xs text-blue-100">{conversations.length} cuộc trò chuyện</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => {
                                                setShowCreateGroup(true);
                                                fetchAllUsers();
                                            }}
                                            className="p-2.5 hover:bg-white/20 rounded-xl transition-colors"
                                            title="Tạo nhóm mới"
                                        >
                                            <Plus size={22} />
                                        </button>
                                        {isMobile && (
                                            <button onClick={() => setIsOpen(false)} className="p-2.5 hover:bg-white/20 rounded-xl transition-colors">
                                                <X size={22} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Search - Glass morphism style */}
                                <div className="relative">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Tìm kiếm cuộc trò chuyện..."
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:bg-white/25 border border-white/20 focus:border-white/40 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Tabs - Modern pill style */}
                        <div className="flex gap-1 p-2 bg-gray-50 shrink-0">
                            <button
                                onClick={() => setSearchMode('conversations')}
                                className={`flex-1 py-2.5 px-4 text-sm font-medium transition-all rounded-lg flex items-center justify-center gap-2 ${
                                    searchMode === 'conversations' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <MessageSquare size={16} />
                                Trò chuyện
                            </button>
                            <button
                                onClick={() => setSearchMode('users')}
                                className={`flex-1 py-2.5 px-4 text-sm font-medium transition-all rounded-lg flex items-center justify-center gap-2 ${
                                    searchMode === 'users' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <Users size={16} />
                                Người dùng
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto bg-white">
                            {loading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="text-center">
                                        <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">Đang tải...</p>
                                    </div>
                                </div>
                            ) : searchMode === 'conversations' ? (
                                filteredConversations.length === 0 ? (
                                    <div className="text-center py-16 px-6">
                                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                                            <MessageSquare size={32} className="text-blue-400" />
                                        </div>
                                        <p className="text-base font-semibold text-gray-700 mb-1">Chưa có tin nhắn</p>
                                        <p className="text-sm text-gray-400">Bắt đầu trò chuyện với ai đó ngay nào!</p>
                                        <button 
                                            onClick={() => setSearchMode('users')}
                                            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Tìm người dùng
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-1">
                                        {filteredConversations.map(conv => (
                                            <div
                                                key={conv.id}
                                                onClick={() => openConversation(conv)}
                                                className={`flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition-all group ${
                                                    conv.unreadCount > 0 ? 'bg-blue-50/50' : ''
                                                }`}
                                            >
                                                <div className="relative shrink-0">
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg overflow-hidden shadow-md ${
                                                        conv.type === 'GROUP' 
                                                            ? 'bg-gradient-to-br from-purple-500 to-indigo-600' 
                                                            : 'bg-gradient-to-br from-blue-500 to-blue-600'
                                                    }`}>
                                                        {conv.displayAvatar ? (
                                                            <img src={conv.displayAvatar} alt="" className="w-full h-full object-cover" />
                                                        ) : conv.type === 'GROUP' ? (
                                                            <Users size={22} className="text-white" />
                                                        ) : (
                                                            conv.displayName.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    {/* Online indicator */}
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                                                    {conv.unreadCount > 0 && (
                                                        <div className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5 shadow-lg animate-pulse">
                                                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <p className={`font-semibold truncate transition-colors ${
                                                            conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
                                                        } group-hover:text-blue-600`}>
                                                            {conv.displayName}
                                                        </p>
                                                        {conv.lastMessage && (
                                                            <span className={`text-xs shrink-0 ml-2 ${
                                                                conv.unreadCount > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'
                                                            }`}>
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
                                                            đang soạn tin nhắn...
                                                        </p>
                                                    ) : conv.lastMessage ? (
                                                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                                                            {conv.lastMessage.senderId === user?.id && <span className="text-gray-400">Bạn: </span>}
                                                            {conv.lastMessage.messageType === 'VOICE' ? '🎤 Tin nhắn thoại' :
                                                             conv.lastMessage.messageType === 'IMAGE' ? '🖼️ Hình ảnh' :
                                                             conv.lastMessage.messageType === 'FILE' ? '📎 Tệp đính kèm' :
                                                             conv.lastMessage.content}
                                                        </p>
                                                    ) : (
                                                        <p className="text-sm text-gray-400 italic">Chưa có tin nhắn</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                searchUsers.length === 0 ? (
                                    <div className="text-center py-16 px-6">
                                        <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-4">
                                            <Users size={32} className="text-purple-400" />
                                        </div>
                                        <p className="text-base font-semibold text-gray-700 mb-1">
                                            {searchQuery ? 'Không tìm thấy người dùng' : 'Tìm kiếm người dùng'}
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            {searchQuery ? 'Thử tìm với từ khóa khác' : 'Nhập tên hoặc username để tìm'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="py-1">
                                        {searchUsers.map(u => (
                                            <div
                                                key={u.id}
                                                onClick={() => openChatWithUser(u)}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 cursor-pointer transition-all group"
                                            >
                                                <div className="relative shrink-0">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-lg overflow-hidden shadow-md">
                                                        {u.avatarUrl || u.avatar ? (
                                                            <img src={u.avatarUrl || u.avatar} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            u.name.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-800 truncate group-hover:text-emerald-600 transition-colors">{u.name}</p>
                                                    <p className="text-sm text-gray-500 truncate">@{u.username}</p>
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MessageCircle size={18} className="text-emerald-500" />
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

