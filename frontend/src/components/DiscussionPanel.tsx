import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, File, Download, X, Loader2, MessageSquare, Mic, MicOff, Play, Pause, Eye, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DiscussionOnlyOfficeViewer } from './DiscussionOnlyOfficeViewer';

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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Check if file is an Office document
const isOfficeFile = (filename: string | null): boolean => {
    if (!filename) return false;
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'csv', 'txt'].includes(ext);
};

// Check if file is an image
const isImageFile = (filename: string | null): boolean => {
    if (!filename) return false;
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
};

export const DiscussionPanel = ({ projectId }: DiscussionPanelProps) => {
    const { user } = useAuth();
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
    const [showOnlyOffice, setShowOnlyOffice] = useState<{messageId: number; fileName: string} | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Fetch messages
    const fetchMessages = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/projects/${projectId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch messages');
            
            const data = await response.json();
            setMessages(data.messages || []);
            setError(null);
        } catch (err) {
            setError('Không thể tải tin nhắn');
            console.error('Error fetching messages:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
        // Poll for new messages every 5 seconds
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [projectId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            if (file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                setPreviewUrl(url);
            } else {
                setPreviewUrl(null);
            }
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
        try {
            const token = localStorage.getItem('token');
            
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
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                if (!response.ok) throw new Error('Failed to send file');
                
                const message = await response.json();
                setMessages(prev => [...prev, message]);
                removeSelectedFile();
            } else {
                // Send text only
                const response = await fetch(`${API_URL}/projects/${projectId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: newMessage.trim() })
                });
                
                if (!response.ok) throw new Error('Failed to send message');
                
                const message = await response.json();
                setMessages(prev => [...prev, message]);
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
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice-message.webm');
            
            const response = await fetch(`${API_URL}/projects/${projectId}/messages/voice`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!response.ok) throw new Error('Failed to send voice message');
            
            const message = await response.json();
            setMessages(prev => [...prev, message]);
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
        
        switch (message.messageType) {
            case 'TEXT':
                return (
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                );
                
            case 'IMAGE':
                return (
                    <div className="space-y-2">
                        {message.attachmentUrl && (
                            <img 
                                src={message.attachmentUrl} 
                                alt="Hình ảnh"
                                className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setImageModal(message.attachmentUrl)}
                            />
                        )}
                    </div>
                );
                
            case 'FILE':
                return (
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${isOwnMessage ? 'bg-blue-400' : 'bg-gray-100'}`}>
                        {isOfficeFile(message.attachment) ? (
                            <FileText size={20} />
                        ) : (
                            <File size={20} />
                        )}
                        <span className="text-sm flex-1 truncate">{getFileName(message.attachment)}</span>
                        <div className="flex items-center gap-1">
                            {isOfficeFile(message.attachment) && (
                                <button
                                    onClick={() => setShowOnlyOffice({ messageId: message.id, fileName: getFileName(message.attachment) })}
                                    className={`p-1 rounded ${isOwnMessage ? 'hover:bg-blue-300' : 'hover:bg-gray-200'}`}
                                    title="Xem file"
                                >
                                    <Eye size={16} />
                                </button>
                            )}
                            {message.attachmentUrl && (
                                <a 
                                    href={message.attachmentUrl} 
                                    download
                                    className={`p-1 rounded ${isOwnMessage ? 'hover:bg-blue-300' : 'hover:bg-gray-200'}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Tải xuống file"
                                >
                                    <Download size={16} />
                                </a>
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
                            message.attachmentUrl && (
                                <img 
                                    src={message.attachmentUrl} 
                                    alt="Hình ảnh"
                                    className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setImageModal(message.attachmentUrl)}
                                />
                            )
                        ) : (
                            <div className={`flex items-center gap-2 p-2 rounded-lg ${isOwnMessage ? 'bg-blue-400' : 'bg-gray-100'}`}>
                                {isOfficeFile(message.attachment) ? (
                                    <FileText size={20} />
                                ) : (
                                    <File size={20} />
                                )}
                                <span className="text-sm flex-1 truncate">{getFileName(message.attachment)}</span>
                                <div className="flex items-center gap-1">
                                    {isOfficeFile(message.attachment) && (
                                        <button
                                            onClick={() => setShowOnlyOffice({ messageId: message.id, fileName: getFileName(message.attachment) })}
                                            className={`p-1 rounded ${isOwnMessage ? 'hover:bg-blue-300' : 'hover:bg-gray-200'}`}
                                            title="Xem file"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    )}
                                    {message.attachmentUrl && (
                                        <a 
                                            href={message.attachmentUrl} 
                                            download
                                            className={`p-1 rounded ${isOwnMessage ? 'hover:bg-blue-300' : 'hover:bg-gray-200'}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Tải xuống file"
                                        >
                                            <Download size={16} />
                                        </a>
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
                            onClick={() => message.attachmentUrl && toggleAudio(message.id, message.attachmentUrl)}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: '500px', maxHeight: '800px' }}>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <MessageSquare size={24} className="text-blue-500" />
                    <h3 className="text-lg font-semibold text-gray-800">Thảo luận</h3>
                    <span className="text-sm text-gray-500">({messages.length} tin nhắn)</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
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
                                        className={`p-3 rounded-2xl ${
                                            isOwnMessage 
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
            <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-white">
                <div className="flex items-end gap-2">
                    {/* File attachment button */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                        title="Chọn file để đính kèm"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Đính kèm file"
                    >
                        <Paperclip size={20} />
                    </button>
                    
                    {/* Voice recording button */}
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`p-2 rounded-lg ${isRecording ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                        title={isRecording ? 'Dừng ghi âm' : 'Ghi âm'}
                    >
                        {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    
                    {/* Text input */}
                    <div className="flex-1">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendTextMessage();
                                }
                            }}
                            placeholder="Nhập tin nhắn..."
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={1}
                            disabled={sending || isRecording}
                        />
                    </div>
                    
                    {/* Send button */}
                    <button
                        onClick={sendTextMessage}
                        disabled={sending || isRecording || (!newMessage.trim() && !selectedFile)}
                        className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Gửi tin nhắn"
                    >
                        {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
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
