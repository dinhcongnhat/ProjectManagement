import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { Send, Paperclip, Mic, Smile, Download } from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface Message {
    id: number;
    content: string | null;
    messageType: 'TEXT' | 'VOICE' | 'FILE' | 'TEXT_WITH_FILE';
    attachment: string | null;
    createdAt: string;
    sender: {
        id: number;
        name: string;
    };
}

interface DiscussionPanelProps {
    projectId: number;
}

export const DiscussionPanel = ({ projectId }: DiscussionPanelProps) => {
    const { token, user } = useAuth();
    const { socket, connected, sendMessage: sendSocketMessage } = useWebSocket(token);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch messages
    const fetchMessages = async () => {
        try {
            const response = await fetch(`http://localhost:3000/api/projects/${projectId}/messages`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setMessages(data);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, [projectId]);

    // WebSocket listeners
    useEffect(() => {
        if (!socket) return;

        // Join project room
        socket.emit('join_project', projectId.toString());

        // Listen for new messages
        socket.on('new_message', (message: Message) => {
            setMessages(prev => [...prev, message]);
        });

        return () => {
            socket.emit('leave_project', projectId.toString());
            socket.off('new_message');
        };
    }, [socket, projectId]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Send text message
    const handleSendMessage = async () => {
        if ((!newMessage.trim() && !selectedFile) || sending) return;

        setSending(true);
        try {
            if (selectedFile) {
                // Upload file message
                const formData = new FormData();
                if (newMessage.trim()) {
                    formData.append('content', newMessage);
                }
                formData.append('file', selectedFile);

                const response = await fetch(`http://localhost:3000/api/projects/${projectId}/messages/file`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });

                if (response.ok) {
                    const message = await response.json();
                    sendSocketMessage(projectId, message);
                    setMessages(prev => [...prev, message]);
                }
                setSelectedFile(null);
            } else {
                // Send text message
                const response = await fetch(`http://localhost:3000/api/projects/${projectId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ content: newMessage }),
                });

                if (response.ok) {
                    const message = await response.json();
                    sendSocketMessage(projectId, message);
                    setMessages(prev => [...prev, message]);
                }
            }

            setNewMessage('');
            setShowEmojiPicker(false);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const handleEmojiSelect = (emoji: any) => {
        setNewMessage(prev => prev + emoji.native);
        setShowEmojiPicker(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const downloadAttachment = async (messageId: number, filename: string) => {
        try {
            const response = await fetch(`http://localhost:3000/api/messages/${messageId}/attachment`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error downloading attachment:', error);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-gray-500">Đang tải tin nhắn...</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: '600px' }}>
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">Thảo luận dự án</h3>
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-sm text-gray-600">
                            {connected ? 'Đang kết nối' : 'Mất kết nối'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!
                    </div>
                ) : (
                    messages.map((message) => {
                        const isOwn = message.sender.id === user?.id;
                        return (
                            <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                    {!isOwn && (
                                        <span className="text-xs font-medium text-gray-600 px-2">
                                            {message.sender.name}
                                        </span>
                                    )}
                                    <div
                                        className={`px-4 py-2 rounded-lg ${isOwn
                                                ? 'bg-red-600 text-white'
                                                : 'bg-gray-100 text-gray-900'
                                            }`}
                                    >
                                        {message.content && (
                                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                                        )}
                                        {message.attachment && (
                                            <button
                                                onClick={() => downloadAttachment(message.id, message.attachment!)}
                                                className={`flex items-center gap-2 mt-2 text-xs ${isOwn ? 'text-red-100 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                                                    }`}
                                            >
                                                <Download size={14} />
                                                <span className="underline">{message.attachment.split('/').pop()}</span>
                                            </button>
                                        )}
                                    </div>
                                    <span className={`text-xs text-gray-400 px-2`}>
                                        {formatTime(message.createdAt)}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
                {selectedFile && (
                    <div className="mb-2 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <Paperclip size={16} />
                        <span>{selectedFile.name}</span>
                        <button
                            onClick={() => setSelectedFile(null)}
                            className="ml-auto text-red-600 hover:text-red-700"
                        >
                            ✕
                        </button>
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Nhập tin nhắn..."
                            className="w-full px-4 py-2 pr-24 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                            rows={2}
                            disabled={sending}
                        />
                        <div className="absolute right-2 bottom-2 flex items-center gap-1">
                            <button
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="p-1 hover:bg-gray-100 rounded"
                                type="button"
                            >
                                <Smile size={20} className="text-gray-600" />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1 hover:bg-gray-100 rounded"
                                type="button"
                            >
                                <Paperclip size={20} className="text-gray-600" />
                            </button>
                        </div>
                        {showEmojiPicker && (
                            <div className="absolute bottom-12 right-0 z-10">
                                <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" />
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleSendMessage}
                        disabled={(!newMessage.trim() && !selectedFile) || sending}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Send size={18} />
                        Gửi
                    </button>
                </div>
            </div>
        </div>
    );
};
