import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    MessageCircle, X, Search, Users, MessageSquare, Send, Smile,
    Mic, Minimize2, Maximize2, ArrowLeft, Play, Pause,
    Volume2, FileText, Plus, Check, CheckCheck, Loader2, Camera, Trash2, MoreVertical,
    ZoomIn, ZoomOut, RotateCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './ui/Dialog';
import { FileDownloadButton } from './ui/DownloadOptions';
import { AttachmentPicker } from './ui/AttachmentPicker';
import api, { API_URL } from '../config/api';
import { DiscussionOnlyOfficeViewer } from './DiscussionOnlyOfficeViewer';
import { useWebSocket } from '../hooks/useWebSocket';
import ImageCropper from './ImageCropper';
import { resolveAttachmentUrl } from '../utils/urlUtils';

// ==================== ENCRYPTION UTILITIES ====================
const ENCRYPTION_KEY = 'JTSC_CHAT_2025'; // Base key for encryption

// Simple XOR-based encryption for message content
const encryptMessage = (text: string): string => {
    if (!text) return text;
    try {
        const encoded = btoa(unescape(encodeURIComponent(text)));
        let result = '';
        for (let i = 0; i < encoded.length; i++) {
            result += String.fromCharCode(encoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
        }
        return btoa(result);
    } catch {
        return text;
    }
};

const decryptMessage = (encrypted: string): string => {
    if (!encrypted) return encrypted;
    try {
        const decoded = atob(encrypted);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
        }
        return decodeURIComponent(escape(atob(result)));
    } catch {
        return encrypted; // Return original if decryption fails (for non-encrypted messages)
    }
};

// ==================== TYPES ====================
interface User {
    id: number;
    name: string;
    username: string;
    avatar?: string;
    avatarUrl?: string;
    email?: string;
    isOnline?: boolean;
    lastActive?: string;
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
    isRead?: boolean;
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
    avatarUrl: string | null;
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
    readBy?: Record<number, string>; // userId -> readAt timestamp
}

// ==================== UTILITIES ====================
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

// Common emojis for quick picker
const COMMON_EMOJIS = [
    // Faces
    '😀', '😃', '😄', '😁', '😊', '🥰', '😍', '🤩', '😘', '😗',
    '😋', '😛', '🤪', '😎', '🤗', '🤔', '🤫', '🤭', '😏', '😐',
    '😑', '🙄', '😌', '😴', '🥱', '😷', '🤒', '🤕', '🤢', '🤮',
    '😵', '🥴', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟',
    '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
    '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩',
    '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️',
    // Gestures
    '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
    '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
    '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🙏', '🤝', '👏', '🙌',
    // Hearts
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️',
    // Objects
    '🎉', '🎊', '🎁', '🎂', '🍰', '☕', '🍵', '🍺', '🍻', '🥂',
    '🔥', '✨', '⭐', '🌟', '💫', '🎯', '🎪', '🎭', '🎨', '🎬',
];

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

// Format date separator between message groups
const formatDateSeparator = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
        return 'Hôm nay';
    }
    if (isYesterday) {
        return 'Hôm qua';
    }
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

// Check if two dates are on different days
const isDifferentDay = (date1: string, date2: string): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.toDateString() !== d2.toDateString();
};

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

// Optimized Image component with loading state and retry
const ChatImage: React.FC<{
    src: string;
    alt?: string;
    onClick?: () => void;
    isOwn?: boolean;
}> = ({ src, alt = 'Image', onClick, isOwn }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const imgRef = useRef<HTMLImageElement>(null);

    // Preload image
    useEffect(() => {
        setLoading(true);
        setError(false);

        const img = new Image();
        img.onload = () => {
            setLoading(false);
            setError(false);
        };
        img.onerror = () => {
            // Retry up to 3 times with delay
            if (retryCount < 3) {
                setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                }, 1000 * (retryCount + 1)); // Exponential backoff
            } else {
                setLoading(false);
                setError(true);
            }
        };
        img.src = src;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [src, retryCount]);

    if (loading) {
        return (
            <div
                className={`flex items-center justify-center rounded-lg ${isOwn ? 'bg-white/10' : 'bg-gray-100'}`}
                style={{ width: '200px', height: '150px' }}
            >
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className={`animate-spin ${isOwn ? 'text-white/70' : 'text-blue-500'}`} size={24} />
                    <span className={`text-xs ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>Đang tải...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={`flex items-center justify-center rounded-lg cursor-pointer ${isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
                style={{ width: '200px', height: '150px' }}
                onClick={onClick}
            >
                <div className="flex flex-col items-center gap-2">
                    <Camera className={isOwn ? 'text-white/50' : 'text-gray-400'} size={24} />
                    <span className={`text-xs ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>Nhấn để xem</span>
                </div>
            </div>
        );
    }

    return (
        <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxHeight: '200px', maxWidth: '250px' }}
            onClick={onClick}
            loading="lazy"
        />
    );
};

// Image Viewer with zoom, pan, rotate functionality
const ImageViewer: React.FC<{
    src: string;
    onClose: () => void;
}> = ({ src, onClose }) => {
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const MIN_SCALE = 0.5;
    const MAX_SCALE = 5;
    const ZOOM_STEP = 0.25;

    const handleZoomIn = () => {
        setScale(prev => Math.min(prev + ZOOM_STEP, MAX_SCALE));
    };

    const handleZoomOut = () => {
        setScale(prev => Math.max(prev - ZOOM_STEP, MIN_SCALE));
    };

    const handleRotate = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    const handleReset = () => {
        setScale(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
    };

    // Mouse wheel zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setScale(prev => Math.max(MIN_SCALE, Math.min(prev + delta, MAX_SCALE)));
    };

    // Touch pinch zoom
    const lastTouchDistance = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            lastTouchDistance.current = distance;
        } else if (e.touches.length === 1 && scale > 1) {
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y
            });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && lastTouchDistance.current !== null) {
            e.preventDefault();
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = (distance - lastTouchDistance.current) / 100;
            setScale(prev => Math.max(MIN_SCALE, Math.min(prev + delta, MAX_SCALE)));
            lastTouchDistance.current = distance;
        } else if (e.touches.length === 1 && isDragging && scale > 1) {
            setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
            });
        }
    };

    const handleTouchEnd = () => {
        lastTouchDistance.current = null;
        setIsDragging(false);
    };

    // Mouse drag for panning
    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Double click to zoom
    const handleDoubleClick = () => {
        if (scale > 1) {
            handleReset();
        } else {
            setScale(2);
        }
    };

    // Handle background click to close
    const handleBackgroundClick = (e: React.MouseEvent) => {
        if (e.target === containerRef.current) {
            onClose();
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    onClose();
                    break;
                case '+':
                case '=':
                    handleZoomIn();
                    break;
                case '-':
                    handleZoomOut();
                    break;
                case 'r':
                case 'R':
                    handleRotate();
                    break;
                case '0':
                    handleReset();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black/95 z-[10000] flex flex-col"
            onClick={handleBackgroundClick}
        >
            {/* Top Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent z-10">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                    <span>{Math.round(scale * 100)}%</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Image Container */}
            <div
                className="flex-1 flex items-center justify-center overflow-hidden"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onDoubleClick={handleDoubleClick}
                style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
            >
                <img
                    src={src}
                    alt="Preview"
                    className="max-w-none select-none"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                        maxHeight: '90vh',
                        maxWidth: '90vw',
                    }}
                    draggable={false}
                />
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center items-center gap-2 bg-gradient-to-t from-black/50 to-transparent">
                <div className="flex items-center gap-1 bg-black/50 rounded-full p-1">
                    <button
                        onClick={handleZoomOut}
                        disabled={scale <= MIN_SCALE}
                        className="p-3 hover:bg-white/20 rounded-full text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Thu nhỏ (-)"
                    >
                        <ZoomOut size={20} />
                    </button>
                    <button
                        onClick={handleReset}
                        className="px-3 py-2 hover:bg-white/20 rounded-full text-white text-sm transition-colors min-w-[60px]"
                        title="Đặt lại (0)"
                    >
                        {Math.round(scale * 100)}%
                    </button>
                    <button
                        onClick={handleZoomIn}
                        disabled={scale >= MAX_SCALE}
                        className="p-3 hover:bg-white/20 rounded-full text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Phóng to (+)"
                    >
                        <ZoomIn size={20} />
                    </button>
                    <div className="w-px h-6 bg-white/30 mx-1" />
                    <button
                        onClick={handleRotate}
                        className="p-3 hover:bg-white/20 rounded-full text-white transition-colors"
                        title="Xoay (R)"
                    >
                        <RotateCw size={20} />
                    </button>
                </div>
            </div>

            {/* Help text */}
            <div className="absolute bottom-20 left-0 right-0 text-center text-white/50 text-xs">
                Cuộn chuột để zoom • Kéo để di chuyển • Double-click để phóng to/thu nhỏ • ESC để đóng
            </div>
        </div>
    );
};

// Image compression utility - resize and compress images before upload
const compressImage = (file: File, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
        // Skip compression for non-image files or GIFs (to preserve animation)
        if (!file.type.startsWith('image/') || file.type === 'image/gif') {
            resolve(file);
            return;
        }

        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            let { width, height } = img;

            // Calculate new dimensions while maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            // Use better image smoothing for quality
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
            }

            // Convert to blob with compression
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Create new file with same name but compressed
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });

                        console.log(`Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(compressedFile.size / 1024).toFixed(1)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`);
                        resolve(compressedFile);
                    } else {
                        resolve(file); // Fallback to original if compression fails
                    }
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            console.error('Error loading image for compression');
            resolve(file); // Fallback to original on error
        };

        // Load image from file
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsDataURL(file);
    });
};

// Format last active time
const formatLastActive = (lastActive: string | undefined, isOnline: boolean | undefined): string => {
    if (isOnline) return 'Đang hoạt động';
    if (!lastActive) return 'Không xác định';

    const now = new Date();
    const last = new Date(lastActive);
    const diffMs = now.getTime() - last.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Vừa mới truy cập';
    if (diffMinutes < 60) return `Truy cập ${diffMinutes} phút trước`;
    if (diffHours < 24) return `Truy cập ${diffHours} giờ trước`;
    if (diffDays === 1) return 'Truy cập hôm qua';
    if (diffDays < 7) return `Truy cập ${diffDays} ngày trước`;
    return `Truy cập ${last.toLocaleDateString('vi-VN')}`;
};

// ==================== MAIN COMPONENT ====================
const ChatPopup: React.FC = () => {
    const { user, token } = useAuth();
    const { socketRef, connected } = useWebSocket(token);
    const { showConfirm, showError, showWarning } = useDialog();

    // Panel state
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [searchMode, setSearchMode] = useState<'conversations' | 'users'>('conversations');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // Data state
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [pinnedConversations, setPinnedConversations] = useState<Set<number>>(new Set()); // Ghim conversations
    const [searchUsers, setSearchUsers] = useState<User[]>([]);
    const [chatWindows, setChatWindows] = useState<ChatWindow[]>([]);
    const [mobileActiveChat, setMobileActiveChat] = useState<ChatWindow | null>(null);

    // Input state
    const [messageInputs, setMessageInputs] = useState<Record<number, string>>({});
    const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null); // Emoji picker for input
    const [conversationMenuOpen, setConversationMenuOpen] = useState<number | null>(null); // Menu 3 chấm cho conversation list
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

    // Image cropper state
    const [showImageCropper, setShowImageCropper] = useState(false);
    const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
    const [cropTarget, setCropTarget] = useState<'profile' | 'group'>('group');

    // Mention state
    const [showMentionPopup, setShowMentionPopup] = useState<number | null>(null); // conversationId
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStartPos, setMentionStartPos] = useState(0);
    const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // Calculate total unread
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    // Filter and sort conversations (pinned first)
    const filteredConversations = conversations
        .filter(c => c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            const aPinned = pinnedConversations.has(a.id);
            const bPinned = pinnedConversations.has(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return 0; // Keep original order for same pin status
        });

    // ==================== EFFECTS ====================
    // Load pinned conversations from localStorage
    useEffect(() => {
        const savedPinned = localStorage.getItem(`pinnedConversations_${user?.id}`);
        if (savedPinned) {
            try {
                const pinned = JSON.parse(savedPinned);
                setPinnedConversations(new Set(pinned));
            } catch (e) {
                console.error('Error loading pinned conversations:', e);
            }
        }
    }, [user?.id]);

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

    // Listen for notification click to open specific conversation
    useEffect(() => {
        const handleOpenChatFromNotification = async (event: Event) => {
            const customEvent = event as CustomEvent<{ conversationId: number }>;
            const { conversationId } = customEvent.detail;
            console.log('[Chat] Opening conversation from notification:', conversationId);

            // Fetch conversations if not loaded
            if (conversations.length === 0) {
                await fetchConversations();
            }

            // Find the conversation
            const conversation = conversations.find(c => c.id === conversationId);
            if (conversation) {
                openConversation(conversation);
            } else {
                // Try to fetch this specific conversation
                try {
                    const response = await api.get(`/chat/conversations/${conversationId}`);
                    const conv: Conversation = {
                        ...response.data,
                        displayName: response.data.displayName || response.data.name || 'Unknown',
                        displayAvatar: response.data.avatarUrl ? resolveAttachmentUrl(response.data.avatarUrl) : null,
                        avatarUrl: response.data.avatarUrl ? resolveAttachmentUrl(response.data.avatarUrl) : null,
                        unreadCount: response.data.unreadCount || 0
                    };
                    setConversations(prev => [conv, ...prev.filter(c => c.id !== conversationId)]);
                    openConversation(conv);
                } catch (error) {
                    console.error('[Chat] Error fetching conversation from notification:', error);
                }
            }
        };

        window.addEventListener('openChatFromNotification', handleOpenChatFromNotification);
        return () => {
            window.removeEventListener('openChatFromNotification', handleOpenChatFromNotification);
        };
    }, [conversations]);

    // Check URL for openChat param (from notification click when app was closed)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const openChatId = urlParams.get('openChat');

        if (openChatId) {
            const conversationId = parseInt(openChatId, 10);
            if (!isNaN(conversationId)) {
                console.log('[Chat] Opening conversation from URL param:', conversationId);

                // Remove the query param from URL without reload
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);

                // Dispatch event to open chat (will be handled by the other useEffect)
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('openChatFromNotification', {
                        detail: { conversationId }
                    }));
                }, 500); // Small delay to ensure conversations are loaded
            }
        }
    }, []); // Run once on mount

    // Fetch users when switching to users mode or when searchQuery changes
    useEffect(() => {
        if (searchMode === 'users') {
            if (searchQuery) {
                const timer = setTimeout(() => fetchSearchUsers(searchQuery), 300);
                return () => clearTimeout(timer);
            } else {
                // Fetch all users when no search query
                fetchAllUsersForSearch();
            }
        }
    }, [searchQuery, searchMode]);

    // Scroll to bottom only when sending new message, not on every render
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

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

            // Check if user is currently viewing this conversation
            const isViewingConversation =
                mobileActiveChat?.conversationId === data.conversationId ||
                chatWindows.some(w => w.conversationId === data.conversationId && !w.isMinimized);

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

            // If viewing this conversation, mark as read immediately
            if (isViewingConversation) {
                api.put(`/chat/conversations/${data.conversationId}/read`).catch(console.error);
                setConversations(prev => prev.map(c =>
                    c.id === data.conversationId ? { ...c, unreadCount: 0 } : c
                ));
                if (socketRef.current?.connected) {
                    socketRef.current.emit('mark_read', String(data.conversationId));
                }
            } else {
                // Refresh conversations list to update unread count
                fetchConversations();
            }
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
        const handleNewConversation = (data: { conversation: any }) => {
            console.log('[ChatPopup] New conversation received:', data.conversation);
            setConversations(prev => {
                // Check if already exists
                if (prev.some(c => c.id === data.conversation.id)) {
                    return prev;
                }

                // Find the other member's name for private chats
                const otherMember = data.conversation.members?.find((m: any) => m.userId !== user?.id);

                // Process conversation to match format
                const newConv: Conversation = {
                    ...data.conversation,
                    displayName: data.conversation.type === 'GROUP'
                        ? (data.conversation.name || 'Group Chat')
                        : (otherMember?.user?.name || 'Unknown'),
                    displayAvatar: resolveAttachmentUrl(data.conversation.avatarUrl || null) || null,
                    avatarUrl: resolveAttachmentUrl(data.conversation.avatarUrl || null) || null,
                    unreadCount: 0
                };

                return [newConv, ...prev];
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

        // Listen for message deleted
        const handleMessageDeleted = (data: { conversationId: number; messageId: number }) => {
            const removeMessage = (messages: Message[]) =>
                messages.filter(m => m.id !== data.messageId);

            setChatWindows(prev => prev.map(w =>
                w.conversationId === data.conversationId
                    ? { ...w, messages: removeMessage(w.messages) }
                    : w
            ));

            setMobileActiveChat(prev => {
                if (prev?.conversationId === data.conversationId) {
                    return { ...prev, messages: removeMessage(prev.messages) };
                }
                return prev;
            });
        };

        socketRef.current.on('chat:message_deleted', handleMessageDeleted);

        return () => {
            socketRef.current?.off('chat:new_message', handleNewMessage);
            socketRef.current?.off('chat:typing', handleTyping);
            socketRef.current?.off('chat:stop_typing', handleStopTyping);
            socketRef.current?.off('chat:reaction_added', handleReactionAdded);
            socketRef.current?.off('chat:reaction_removed', handleReactionRemoved);
            socketRef.current?.off('chat:new_conversation', handleNewConversation);
            socketRef.current?.off('chat:conversation_updated', handleConversationUpdated);
            socketRef.current?.off('chat:message_deleted', handleMessageDeleted);
        };
    }, [connected, socketRef, user?.id]); // Removed mobileActiveChat from dependencies

    // Listen for user online/offline status
    useEffect(() => {
        if (!connected || !socketRef.current) return;

        // Map to track online users
        const handleUserOnline = (data: { userId: number }) => {
            setConversations(prev => prev.map(conv => ({
                ...conv,
                members: conv.members.map(m =>
                    m.userId === data.userId
                        ? { ...m, user: { ...m.user, isOnline: true } }
                        : m
                )
            })));
        };

        const handleUserOffline = (data: { userId: number; lastActive: string }) => {
            setConversations(prev => prev.map(conv => ({
                ...conv,
                members: conv.members.map(m =>
                    m.userId === data.userId
                        ? { ...m, user: { ...m.user, isOnline: false, lastActive: data.lastActive } }
                        : m
                )
            })));
        };

        // Handle read receipts
        const handleConversationRead = (data: { conversationId: number; userId: number; readAt: string }) => {
            // Mark messages as read by that user
            setChatWindows(prev => prev.map(w => {
                if (w.conversationId === data.conversationId) {
                    return {
                        ...w,
                        readBy: { ...(w.readBy || {}), [data.userId]: data.readAt }
                    };
                }
                return w;
            }));
        };

        socketRef.current.on('user:online', handleUserOnline);
        socketRef.current.on('user:offline', handleUserOffline);
        socketRef.current.on('conversation_read', handleConversationRead);

        return () => {
            socketRef.current?.off('user:online', handleUserOnline);
            socketRef.current?.off('user:offline', handleUserOffline);
            socketRef.current?.off('conversation_read', handleConversationRead);
        };
    }, [connected, socketRef]);

    // ==================== API FUNCTIONS ====================
    const fetchConversations = async () => {
        if (!user || !token) return;

        try {
            setLoading(true);
            const response = await api.get('/chat/conversations');
            const data = response.data.map((conv: any) => ({
                ...conv,
                displayName: conv.displayName || conv.name || 'Unknown',
                displayAvatar: conv.avatarUrl ? resolveAttachmentUrl(conv.avatarUrl) : null,
                avatarUrl: conv.avatarUrl ? resolveAttachmentUrl(conv.avatarUrl) : null,
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
            // Add avatarUrl for each user
            const usersWithAvatarUrl = response.data
                .filter((u: User) => u.id !== user?.id)
                .map((u: User) => ({
                    ...u,
                    avatarUrl: u.avatar ? `/api/users/${u.id}/avatar` : null
                }));
            setSearchUsers(usersWithAvatarUrl);
        } catch (error) {
            console.error('Error searching users:', error);
            setSearchUsers([]);
        }
    };

    // Fetch all users for search panel (when no search query)
    const fetchAllUsersForSearch = async () => {
        try {
            const response = await api.get('/users');
            // Add avatarUrl for each user
            const usersWithAvatarUrl = response.data
                .filter((u: User) => u.id !== user?.id)
                .map((u: User) => ({
                    ...u,
                    avatarUrl: u.avatar ? `/api/users/${u.id}/avatar` : null
                }));
            setSearchUsers(usersWithAvatarUrl);
        } catch (error) {
            console.error('Error fetching all users:', error);
            setSearchUsers([]);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const response = await api.get('/users');
            // Add avatarUrl for each user
            const usersWithAvatarUrl = response.data
                .filter((u: User) => u.id !== user?.id)
                .map((u: User) => ({
                    ...u,
                    avatarUrl: u.avatar ? `/api/users/${u.id}/avatar` : null
                }));
            setAllUsers(usersWithAvatarUrl);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    // Toggle pin conversation
    const togglePinConversation = (conversationId: number) => {
        setPinnedConversations(prev => {
            const newSet = new Set(prev);
            if (newSet.has(conversationId)) {
                newSet.delete(conversationId);
            } else {
                newSet.add(conversationId);
            }
            // Save to localStorage
            localStorage.setItem(`pinnedConversations_${user?.id}`, JSON.stringify([...newSet]));
            return newSet;
        });
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
                    displayAvatar: resolveAttachmentUrl(targetUser.avatarUrl || null) || resolveAttachmentUrl(targetUser.avatar || null) || null,
                    avatarUrl: resolveAttachmentUrl(response.data.avatarUrl) || null,
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
                displayAvatar: resolveAttachmentUrl(response.data.avatarUrl) || null,
                avatarUrl: resolveAttachmentUrl(response.data.avatarUrl) || null,
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
            showError('Không thể tạo nhóm. Vui lòng thử lại.');
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

            // Scroll to bottom after opening
            setTimeout(scrollToBottom, 150);

            // Mark as read even for existing window
            try {
                await api.put(`/chat/conversations/${conversation.id}/read`);
                setConversations(prev => prev.map(c =>
                    c.id === conversation.id ? { ...c, unreadCount: 0 } : c
                ));
                if (socketRef.current?.connected) {
                    socketRef.current.emit('mark_read', String(conversation.id));
                }
            } catch (error) {
                console.error('Error marking as read:', error);
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

        // Scroll to bottom after setting messages
        setTimeout(scrollToBottom, 150);

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
            // Emit read receipt to other users
            if (socketRef.current?.connected) {
                socketRef.current.emit('mark_read', String(conversation.id));
            }
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

    // Delete entire conversation
    const deleteConversation = async (conversationId: number) => {
        const confirmed = await showConfirm('Bạn có chắc muốn xóa cuộc hội thoại này? Tất cả tin nhắn sẽ bị xóa vĩnh viễn.', {
            title: 'Xóa cuộc hội thoại',
            confirmText: 'Xóa',
            cancelText: 'Hủy'
        });

        if (!confirmed) return;

        try {
            await api.delete(`/chat/conversations/${conversationId}`);

            // Remove from conversations list
            setConversations(prev => prev.filter(c => c.id !== conversationId));

            // Close any open window for this conversation
            setChatWindows(prev => prev.filter(w => w.conversationId !== conversationId));

            if (mobileActiveChat?.conversationId === conversationId) {
                setMobileActiveChat(null);
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            showError('Không thể xóa cuộc hội thoại');
        }
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

        // Check for @ mention trigger
        const cursorPos = (document.activeElement as HTMLInputElement)?.selectionStart || value.length;
        const textBeforeCursor = value.substring(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@(\w*)$/);

        if (atMatch) {
            setMentionQuery(atMatch[1]);
            setMentionStartPos(cursorPos - atMatch[0].length);
            setShowMentionPopup(conversationId);
        } else {
            setShowMentionPopup(null);
            setMentionQuery('');
        }
    };

    // Insert mention into input
    const insertMention = (conversationId: number, userName: string) => {
        const currentInput = messageInputs[conversationId] || '';
        const beforeMention = currentInput.substring(0, mentionStartPos);
        const afterMention = currentInput.substring(mentionStartPos + mentionQuery.length + 1); // +1 for @
        // Use bracket format for names with spaces: @[Tên Đầy Đủ]
        const formattedMention = userName.includes(' ') ? `@[${userName}]` : `@${userName}`;
        const newValue = `${beforeMention}${formattedMention} ${afterMention}`;

        setMessageInputs(prev => ({ ...prev, [conversationId]: newValue }));
        setShowMentionPopup(null);
        setMentionQuery('');

        // Focus back to input
        inputRefs.current[conversationId]?.focus();
    };

    // Get filtered members for mention popup
    const getMentionSuggestions = (conversationId: number) => {
        const window = chatWindows.find(w => w.conversationId === conversationId);
        const mobileChat = mobileActiveChat;
        const members = window?.conversation.members || mobileChat?.conversation.members || [];

        if (!mentionQuery) {
            return members.filter(m => m.user.id !== user?.id).slice(0, 5);
        }

        return members
            .filter(m =>
                m.user.id !== user?.id &&
                m.user.name.toLowerCase().includes(mentionQuery.toLowerCase())
            )
            .slice(0, 5);
    };

    // Render message content with mentions highlighted
    const renderMessageWithMentions = (content: string | null): React.ReactNode => {
        if (!content) return null;

        // Pattern to find @[Full Name] or @username mentions
        // First pattern: @[Name With Spaces] - names in brackets
        // Second pattern: @username - single word without spaces
        const mentionPattern = /@\[([^\]]+)\]|@(\S+)/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = mentionPattern.exec(content)) !== null) {
            // Add text before mention
            if (match.index > lastIndex) {
                parts.push(content.substring(lastIndex, match.index));
            }

            // match[1] is for @[Name] format, match[2] is for @username format
            const mentionName = match[1] || match[2];

            // Add highlighted mention
            parts.push(
                <span
                    key={match.index}
                    className="bg-blue-100 text-blue-700 px-1 rounded font-medium cursor-pointer hover:bg-blue-200"
                    title={`Tag: ${mentionName}`}
                >
                    @{mentionName}
                </span>
            );

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }

        return parts.length > 0 ? <>{parts}</> : content;
    };

    const sendMessage = async (conversationId: number, content: string) => {
        if (!content.trim()) return;

        // Encrypt the message content
        const encryptedContent = encryptMessage(content.trim());

        // Stop typing indicator
        if (socketRef.current?.connected) {
            socketRef.current.emit('chat:stop_typing', {
                conversationId,
                userId: user?.id
            });
        }

        // Optimistic update - Add message immediately (show original content locally)
        // Use negative ID to distinguish from real messages and avoid INT4 overflow
        const tempId = -Math.floor(Math.random() * 1000000) - 1;
        const optimisticMessage: Message = {
            id: tempId, // Temporary negative ID to distinguish from real messages
            content: content.trim(), // Show original content locally
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

        // Scroll to bottom
        setTimeout(scrollToBottom, 100);

        // Clear input immediately
        setMessageInputs(prev => ({ ...prev, [conversationId]: '' }));

        try {
            const response = await api.post(`/chat/conversations/${conversationId}/messages`, {
                content: encryptedContent,
                messageType: 'TEXT'
            });

            const realMessage = { ...response.data, content: content.trim() }; // Keep original content for display

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

            showError('Không thể gửi tin nhắn. Vui lòng thử lại.');
        }
    };

    // Delete message
    const deleteMessage = async (messageId: number, conversationId: number) => {
        const confirmed = await showConfirm('Bạn có chắc muốn xóa tin nhắn này?', {
            title: 'Xóa tin nhắn',
            confirmText: 'Xóa',
            cancelText: 'Hủy'
        });

        if (!confirmed) return;

        try {
            await api.delete(`/chat/messages/${messageId}`);

            // Optimistic update
            setChatWindows(prev => prev.map(w =>
                w.conversationId === conversationId
                    ? { ...w, messages: w.messages.filter(m => m.id !== messageId) }
                    : w
            ));

            if (mobileActiveChat?.conversationId === conversationId) {
                setMobileActiveChat(prev => prev ? {
                    ...prev,
                    messages: prev.messages.filter(m => m.id !== messageId)
                } : null);
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            showError('Không thể xóa tin nhắn');
        }
    };

    // Add reaction to message
    const addReaction = async (messageId: number, emoji: string) => {
        // Prevent adding reaction to optimistic messages (negative IDs)
        if (messageId < 0) {
            console.warn('Cannot add reaction to unsent message');
            setShowReactionPicker(null);
            return;
        }
        try {
            await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
            setShowReactionPicker(null);
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    };

    // Remove reaction from message
    const removeReaction = async (messageId: number, emoji: string) => {
        // Prevent removing reaction from optimistic messages (negative IDs)
        if (messageId < 0) {
            console.warn('Cannot remove reaction from unsent message');
            return;
        }
        try {
            await api.delete(`/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
        } catch (error) {
            console.error('Error removing reaction:', error);
        }
    };

    // Toggle reaction (add if not exists, remove if exists)
    const toggleReaction = async (msg: Message, emoji: string) => {
        // Prevent toggling reaction on optimistic messages (negative IDs)
        if (msg.id < 0) {
            console.warn('Cannot react to unsent message');
            setShowReactionPicker(null);
            return;
        }
        const existingReaction = msg.reactions?.find(r => r.emoji === emoji && r.userId === user?.id);
        if (existingReaction) {
            await removeReaction(msg.id, emoji);
        } else {
            await addReaction(msg.id, emoji);
        }
    };

    const handleFileUpload = async (conversationId: number, file: File) => {
        if (!file) return;

        console.log('[ChatPopup] Starting file upload:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            conversationId
        });

        const isImage = file.type.startsWith('image/');

        // Compress image before upload if it's an image
        let fileToUpload = file;
        if (isImage) {
            try {
                setUploadProgress(prev => ({ ...prev, [conversationId]: 0 }));
                fileToUpload = await compressImage(file, 1200, 1200, 0.8);
                console.log('[ChatPopup] Image compressed:', {
                    originalSize: file.size,
                    compressedSize: fileToUpload.size
                });
            } catch (error) {
                console.error('Error compressing image:', error);
                // Continue with original file if compression fails
            }
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('messageType', isImage ? 'IMAGE' : 'FILE');

        console.log('[ChatPopup] FormData created, uploading to:', `${API_URL}/chat/conversations/${conversationId}/messages/file`);

        try {
            if (!isImage) {
                setUploadProgress(prev => ({ ...prev, [conversationId]: 0 }));
            }

            // Use XMLHttpRequest for upload progress tracking
            const token = localStorage.getItem('token');
            console.log('[ChatPopup] Token exists:', !!token);

            const response = await new Promise<any>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentCompleted = Math.round((e.loaded * 100) / e.total);
                        setUploadProgress(prev => ({ ...prev, [conversationId]: percentCompleted }));
                        console.log('[ChatPopup] Upload progress:', percentCompleted + '%');
                    }
                });

                xhr.addEventListener('load', () => {
                    console.log('[ChatPopup] Upload completed with status:', xhr.status);
                    console.log('[ChatPopup] Response text:', xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch (e) {
                            console.error('[ChatPopup] Failed to parse response:', e);
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    console.error('[ChatPopup] Upload error event');
                    reject(new Error('Upload failed'));
                });
                xhr.addEventListener('abort', () => {
                    console.error('[ChatPopup] Upload aborted');
                    reject(new Error('Upload cancelled'));
                });

                xhr.open('POST', `${API_URL}/chat/conversations/${conversationId}/messages/file`);
                if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }
                xhr.send(formData);
            });

            console.log('[ChatPopup] File uploaded successfully:', response);

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
            console.error('[ChatPopup] Error uploading file:', error);
            showError('Không thể tải file lên. Vui lòng thử lại.');
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
                showWarning('Trình duyệt không hỗ trợ ghi âm');
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
            showError('Không thể bắt đầu ghi âm. Vui lòng kiểm tra quyền truy cập microphone.');
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
    const toggleAudioPlayback = (e: React.MouseEvent, messageId: number, audioUrl: string) => {
        e.preventDefault();
        e.stopPropagation();

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
        // Resolve attachment URL to absolute URL
        const resolvedAttachmentUrl = resolveAttachmentUrl(msg.attachmentUrl);

        // Debug logging for file messages
        if (msg.messageType === 'IMAGE' || msg.messageType === 'FILE') {
            console.log('[ChatPopup] Rendering file message:', {
                messageId: msg.id,
                messageType: msg.messageType,
                attachment: msg.attachment,
                attachmentUrl: msg.attachmentUrl,
                resolvedAttachmentUrl,
                filename
            });
        }

        switch (msg.messageType) {
            case 'VOICE':
                return (
                    <div className="flex items-center gap-2 min-w-[180px]">
                        <button
                            onClick={(e) => resolvedAttachmentUrl && toggleAudioPlayback(e, msg.id, resolvedAttachmentUrl)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-blue-500 hover:bg-blue-600 text-white'
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
                const imageUrl = resolvedAttachmentUrl || msg.attachment;
                return imageUrl ? (
                    <ChatImage
                        src={imageUrl}
                        alt="Image"
                        isOwn={isOwn}
                        onClick={() => setImagePreview(imageUrl)}
                    />
                ) : (
                    <p className="text-sm text-gray-500">Hình ảnh không khả dụng</p>
                );

            case 'FILE':
            case 'TEXT_WITH_FILE':
                // Truncate long filenames
                const displayFilename = filename.length > 25
                    ? filename.substring(0, 20) + '...' + filename.substring(filename.lastIndexOf('.'))
                    : filename;

                return (
                    <div className="max-w-[220px]">
                        {msg.content && <p className="mb-2 whitespace-pre-wrap break-words">{renderMessageWithMentions(msg.content)}</p>}
                        {resolvedAttachmentUrl && (
                            <div
                                className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${isOwn
                                    ? 'bg-white/10 hover:bg-white/20'
                                    : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm'
                                    }`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isOfficeFile(filename)) {
                                        setShowOnlyOffice({ messageId: msg.id, filename });
                                    } else {
                                        window.open(resolvedAttachmentUrl!, '_blank');
                                    }
                                }}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 ${getFileIconColor(filename)}`}>
                                    <FileText size={18} />
                                </div>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <p
                                        className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-gray-800'}`}
                                        title={filename}
                                    >
                                        {displayFilename}
                                    </p>
                                    <p className={`text-xs ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                                        {isOfficeFile(filename) ? 'Nhấn để xem' : 'Nhấn để tải'}
                                    </p>
                                </div>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <FileDownloadButton
                                        fileName={filename}
                                        downloadUrl={resolvedAttachmentUrl || ''}
                                        token={token || ''}
                                        isOwnMessage={isOwn}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );

            default:
                return <p className="whitespace-pre-wrap break-words">{renderMessageWithMentions(msg.content)}</p>;
        }
    };

    // ==================== RENDER CHAT WINDOW ====================
    const renderChatWindow = (window: ChatWindow, index: number) => {
        const conversationId = window.conversationId;
        const messageInput = messageInputs[conversationId] || '';
        const progress = uploadProgress[conversationId];

        // Get other user's online status for private chat
        const getOtherUserStatus = () => {
            if (window.conversation.type !== 'PRIVATE') return { isOnline: false, lastActive: undefined };
            const otherMember = window.conversation.members.find(m => m.userId !== user?.id);
            return {
                isOnline: otherMember?.user?.isOnline || false,
                lastActive: otherMember?.user?.lastActive
            };
        };
        const otherStatus = getOtherUserStatus();

        const baseRight = 100 + index * 340;
        const windowStyle: React.CSSProperties = window.isMaximized
            ? { position: 'fixed', bottom: 20, right: baseRight, width: 500, height: 600, zIndex: 60 }
            : { position: 'fixed', bottom: 20, right: baseRight, width: 360, height: window.isMinimized ? 48 : 500, zIndex: 60 };

        return (
            <div
                key={window.id}
                className="bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-200"
                style={windowStyle}
            >
                {/* Header - Clean White Design */}
                <div
                    className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-gray-100 cursor-pointer shrink-0"
                    onClick={() => toggleMinimize(window.id)}
                >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                {window.conversation.displayAvatar ? (
                                    <img src={window.conversation.displayAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-white text-sm font-semibold">{window.conversation.displayName.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${otherStatus.isOnline ? 'bg-green-500' : 'bg-gray-400'} rounded-full border-2 border-white`}></div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold text-gray-800 text-sm truncate block">{window.conversation.displayName}</span>
                            <div className="flex items-center gap-1">
                                {otherStatus.isOnline && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>}
                                <span className={`text-xs ${otherStatus.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                                    {formatLastActive(otherStatus.lastActive, otherStatus.isOnline)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center shrink-0 gap-0.5">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.isMaximized) {
                                    toggleMaximize(window.id);
                                } else if (window.isMinimized) {
                                    toggleMinimize(window.id);
                                } else {
                                    toggleMaximize(window.id);
                                }
                            }}
                            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                            title={window.isMaximized ? "Thu nhỏ" : "Phóng to"}
                        >
                            {window.isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); closeWindow(window.id); }}
                            className="w-8 h-8 flex items-center justify-center hover:bg-red-50 rounded-full transition-colors text-gray-500 hover:text-red-500"
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
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                            {window.messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                                    <MessageSquare size={40} className="mb-2 opacity-30" />
                                    <p className="text-sm">Bắt đầu cuộc trò chuyện</p>
                                </div>
                            ) : (
                                <>
                                    {window.messages.map((msg, msgIndex) => {
                                        const isOwn = msg.sender.id === user?.id;
                                        const groupedReactions = msg.reactions?.reduce((acc, r) => {
                                            if (!acc[r.emoji]) acc[r.emoji] = [];
                                            acc[r.emoji].push(r);
                                            return acc;
                                        }, {} as Record<string, Reaction[]>) || {};
                                        const displayContent = msg.messageType === 'TEXT' && msg.content ? decryptMessage(msg.content) : msg.content;

                                        // Check if this is a new sender group (different sender from previous message)
                                        const prevMsg = window.messages[msgIndex - 1];
                                        const isNewSenderGroup = !prevMsg || prevMsg.sender.id !== msg.sender.id;
                                        // Check if next message is from same sender
                                        const nextMsg = window.messages[msgIndex + 1];
                                        const isLastInGroup = !nextMsg || nextMsg.sender.id !== msg.sender.id;

                                        // Check if we need date separator
                                        const showDateSeparator = !prevMsg || isDifferentDay(prevMsg.createdAt, msg.createdAt);

                                        return (
                                            <React.Fragment key={msg.id}>
                                                {/* Date separator */}
                                                {showDateSeparator && (
                                                    <div className="flex items-center justify-center my-3">
                                                        <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                                                            {formatDateSeparator(msg.createdAt)}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group ${!isNewSenderGroup ? 'mt-0.5' : 'mt-3'}`}>
                                                    {/* Avatar for other users - only show on last message in group */}
                                                    {!isOwn && (
                                                        <div className="w-8 h-8 mr-2 shrink-0">
                                                            {isLastInGroup ? (
                                                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
                                                                    {msg.sender.avatar ? (
                                                                        <img
                                                                            src={resolveAttachmentUrl(msg.sender.avatar) || ''}
                                                                            alt=""
                                                                            className="w-full h-full object-cover"
                                                                            onError={(e) => {
                                                                                const target = e.target as HTMLImageElement;
                                                                                target.style.display = 'none';
                                                                                const sibling = target.nextElementSibling as HTMLElement;
                                                                                if (sibling) sibling.style.display = 'block';
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <span
                                                                        className="text-white font-semibold text-xs"
                                                                        style={{ display: msg.sender.avatar ? 'none' : 'block' }}
                                                                    >
                                                                        {msg.sender.name.charAt(0).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    )}

                                                    <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col relative`}>
                                                        {/* Sender name with time - only show on first message in group */}
                                                        {!isOwn && isNewSenderGroup && (
                                                            <div className="flex items-center gap-1.5 mb-0.5 ml-1">
                                                                <span className="text-xs text-gray-600 font-medium">{msg.sender.name}</span>
                                                                <span className="text-xs text-gray-300">•</span>
                                                                <span className="text-xs text-gray-400">{formatMessageTime(msg.createdAt)}</span>
                                                            </div>
                                                        )}
                                                        {/* Time for own messages - show on first of group */}
                                                        {isOwn && isNewSenderGroup && (
                                                            <div className="flex justify-end mb-0.5 mr-1">
                                                                <span className="text-xs text-gray-400">{formatMessageTime(msg.createdAt)}</span>
                                                            </div>
                                                        )}
                                                        <div className="relative">
                                                            <div className={`px-3 py-2 rounded-2xl shadow-sm ${isOwn
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-white text-gray-800 border border-gray-100'
                                                                } ${isOwn && isLastInGroup ? 'rounded-br-md' : ''} ${!isOwn && isLastInGroup ? 'rounded-bl-md' : ''}`}>
                                                                {renderMessage({ ...msg, content: displayContent }, isOwn)}
                                                            </div>

                                                            {/* Reaction buttons - Show on hover for desktop */}
                                                            <div className={`absolute ${isOwn ? '-left-24' : '-right-24'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white rounded-full shadow-md border px-1 py-0.5`}>
                                                                {REACTION_EMOJIS.slice(0, 3).map(emoji => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => toggleReaction(msg, emoji)}
                                                                        className="text-sm hover:scale-125 transition-transform p-0.5"
                                                                        title={emoji}
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                                <button
                                                                    onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                                                                    className="p-0.5 text-gray-400 hover:text-gray-600"
                                                                    title="Thêm reaction"
                                                                >
                                                                    <Plus size={12} />
                                                                </button>
                                                                {isOwn && (
                                                                    <button
                                                                        onClick={() => deleteMessage(msg.id, conversationId)}
                                                                        className="p-0.5 text-gray-400 hover:text-red-500"
                                                                        title="Xóa tin nhắn"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Full Reaction Picker - shown when clicking Plus */}
                                                            {showReactionPicker === msg.id && (
                                                                <>
                                                                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowReactionPicker(null)} />
                                                                    <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-10 bg-white rounded-full shadow-lg border px-2 py-1 flex gap-1 z-[9999]`}>
                                                                        {REACTION_EMOJIS.map(emoji => (
                                                                            <button
                                                                                key={emoji}
                                                                                onClick={() => {
                                                                                    toggleReaction(msg, emoji);
                                                                                    setShowReactionPicker(null);
                                                                                }}
                                                                                className="text-base hover:scale-125 transition-transform p-0.5"
                                                                            >
                                                                                {emoji}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Reactions */}
                                                        {Object.keys(groupedReactions).length > 0 && (
                                                            <div className={`flex gap-0.5 mt-0.5 ${isOwn ? 'justify-end' : ''}`}>
                                                                {Object.entries(groupedReactions).map(([emoji, reactions]) => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => toggleReaction(msg, emoji)}
                                                                        className={`text-xs px-1 py-0.5 rounded-full ${reactions.some(r => r.userId === user?.id)
                                                                            ? 'bg-blue-100'
                                                                            : 'bg-gray-100'
                                                                            }`}
                                                                    >
                                                                        {emoji}{reactions.length > 1 && reactions.length}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </React.Fragment>
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

                            {/* Read receipt indicator - show if last message is mine and read by others */}
                            {(() => {
                                const myLastMsg = [...window.messages].reverse().find(m => m.sender.id === user?.id);
                                const otherMembers = window.conversation.members.filter((m: ConversationMember) => m.user.id !== user?.id);
                                const hasOtherMembersRead = window.readBy && Object.keys(window.readBy).some(
                                    uid => parseInt(uid) !== user?.id &&
                                        myLastMsg &&
                                        new Date(window.readBy![parseInt(uid)]) >= new Date(myLastMsg.createdAt)
                                );

                                if (myLastMsg && otherMembers.length > 0) {
                                    return (
                                        <div className="flex justify-end px-4 py-1">
                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                {hasOtherMembersRead ? (
                                                    <>
                                                        <CheckCheck size={14} className="text-blue-500" />
                                                        <span className="text-blue-500">Đã xem</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check size={14} />
                                                        <span>Đã gửi</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Upload Progress */}
                        {progress !== undefined && (
                            <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                                <div className="flex items-center gap-3">
                                    <Loader2 className="animate-spin text-blue-600" size={18} />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-blue-700 font-medium">Đang tải lên...</span>
                                            <span className="text-xs text-blue-600 font-bold">{progress}%</span>
                                        </div>
                                        <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-600 rounded-full transition-all duration-300"
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
                                            title="Chọn emoji"
                                        >
                                            <Smile size={18} />
                                        </button>

                                        {/* Emoji Picker Popup */}
                                        {showEmojiPicker === conversationId && (
                                            <>
                                                <div className="fixed inset-0 z-[9990]" onClick={() => setShowEmojiPicker(null)} />
                                                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border p-2 z-[9991] w-64 max-h-48 overflow-y-auto">
                                                    <div className="grid grid-cols-8 gap-0.5">
                                                        {COMMON_EMOJIS.map((emoji, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => {
                                                                    setMessageInputs(prev => ({
                                                                        ...prev,
                                                                        [conversationId]: (prev[conversationId] || '') + emoji
                                                                    }));
                                                                    setShowEmojiPicker(null);
                                                                }}
                                                                className="text-lg p-1 hover:bg-gray-100 rounded transition-colors"
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
                                    <AttachmentPicker
                                        token={token || ''}
                                        onFilesSelected={(files) => {
                                            if (files.length > 0) {
                                                handleFileUpload(conversationId, files[0]);
                                            }
                                        }}
                                        multiple={false}
                                        buttonClassName="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors shrink-0"
                                        iconSize={18}
                                    />

                                    {/* Text Input with Mention Popup */}
                                    <div className="relative flex-1 min-w-0">
                                        <input
                                            ref={el => { inputRefs.current[conversationId] = el; }}
                                            type="text"
                                            value={messageInput}
                                            onChange={(e) => handleInputChange(conversationId, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (showMentionPopup === conversationId) {
                                                    const suggestions = getMentionSuggestions(conversationId);
                                                    if (e.key === 'Escape') {
                                                        e.preventDefault();
                                                        setShowMentionPopup(null);
                                                    } else if (e.key === 'Enter' && suggestions.length > 0) {
                                                        e.preventDefault();
                                                        insertMention(conversationId, suggestions[0].user.name);
                                                    }
                                                } else if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendMessage(conversationId, messageInput);
                                                }
                                            }}
                                            placeholder="Aa"
                                            className="w-full px-3 py-1.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            data-conversation-id={conversationId}
                                        />

                                        {/* Mention Popup */}
                                        {showMentionPopup === conversationId && (
                                            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border py-1 z-[9999] w-56 max-h-48 overflow-y-auto">
                                                {getMentionSuggestions(conversationId).length > 0 ? (
                                                    getMentionSuggestions(conversationId).map((member) => (
                                                        <button
                                                            key={member.user.id}
                                                            onClick={() => insertMention(conversationId, member.user.name)}
                                                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-blue-50 transition-colors text-left"
                                                        >
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                                                                {member.user.avatarUrl ? (
                                                                    <img src={resolveAttachmentUrl(member.user.avatarUrl) || ''} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-blue-600 font-medium text-sm">{member.user.name.charAt(0).toUpperCase()}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-medium text-gray-800 truncate">{member.user.name}</div>
                                                                <div className="text-xs text-gray-500 truncate">{member.user.email}</div>
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy người dùng</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

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
                                        className={`p-1.5 rounded-full transition-all shrink-0 ${messageInput.trim()
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

        // Get other user's online status for private chat
        const getOtherUserStatus = () => {
            if (mobileActiveChat.conversation.type !== 'PRIVATE') return { isOnline: false, lastActive: undefined };
            const otherMember = mobileActiveChat.conversation.members.find(m => m.userId !== user?.id);
            return {
                isOnline: otherMember?.user?.isOnline || false,
                lastActive: otherMember?.user?.lastActive
            };
        };
        const otherStatus = getOtherUserStatus();

        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col">
                {/* Header - Clean Design with safe area */}
                <div className="bg-blue-600 shrink-0 shadow-sm" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)' }}>
                    <div className="flex items-center gap-3 px-3 py-3">
                        <button
                            onClick={() => { setMobileActiveChat(null); setIsOpen(true); }}
                            className="w-10 h-10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-xl transition-colors"
                        >
                            <ArrowLeft size={22} className="text-white" />
                        </button>
                        <div className="relative">
                            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden shadow-lg ring-2 ring-white/30">
                                {mobileActiveChat.conversation.displayAvatar ? (
                                    <img src={mobileActiveChat.conversation.displayAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-bold text-white text-lg">{mobileActiveChat.conversation.displayName.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${otherStatus.isOnline ? 'bg-green-400' : 'bg-gray-300'} rounded-full border-2 border-white shadow-sm`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="font-bold text-white truncate block text-base">{mobileActiveChat.conversation.displayName}</span>
                            <div className="flex items-center gap-1.5">
                                {isTyping ? (
                                    <span className="text-xs text-white/80 font-medium flex items-center gap-1">
                                        <span className="inline-flex gap-0.5">
                                            <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </span>
                                        đang soạn...
                                    </span>
                                ) : (
                                    <>
                                        {otherStatus.isOnline && <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>}
                                        <span className={`text-xs ${otherStatus.isOnline ? 'text-green-300' : 'text-white/60'}`}>
                                            {formatLastActive(otherStatus.lastActive, otherStatus.isOnline)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        {/* Control Button */}
                        <button
                            onClick={() => setMobileActiveChat(null)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-xl transition-colors"
                            title="Đóng"
                        >
                            <X size={22} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-0.5 bg-gray-50">
                    {mobileActiveChat.messages.map((msg, msgIndex) => {
                        const isOwn = msg.sender.id === user?.id;
                        const groupedReactions = msg.reactions?.reduce((acc, r) => {
                            if (!acc[r.emoji]) acc[r.emoji] = [];
                            acc[r.emoji].push(r);
                            return acc;
                        }, {} as Record<string, Reaction[]>) || {};
                        const displayContent = msg.messageType === 'TEXT' && msg.content ? decryptMessage(msg.content) : msg.content;

                        // Check if this is a new sender group
                        const prevMsg = mobileActiveChat.messages[msgIndex - 1];
                        const isNewSenderGroup = !prevMsg || prevMsg.sender.id !== msg.sender.id;
                        const nextMsg = mobileActiveChat.messages[msgIndex + 1];
                        const isLastInGroup = !nextMsg || nextMsg.sender.id !== msg.sender.id;

                        // Check if we need date separator
                        const showDateSeparator = !prevMsg || isDifferentDay(prevMsg.createdAt, msg.createdAt);

                        return (
                            <React.Fragment key={msg.id}>
                                {/* Date separator */}
                                {showDateSeparator && (
                                    <div className="flex items-center justify-center my-3">
                                        <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                                            {formatDateSeparator(msg.createdAt)}
                                        </div>
                                    </div>
                                )}
                                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${isNewSenderGroup ? 'mt-3' : 'mt-0.5'}`}>
                                    {/* Avatar for other users */}
                                    {!isOwn && (
                                        <div className="w-8 h-8 mr-2 shrink-0">
                                            {isLastInGroup ? (
                                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
                                                    {msg.sender.id ? (
                                                        <img
                                                            src={`/api/users/${msg.sender.id}/avatar`}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                                const sibling = target.nextElementSibling as HTMLElement;
                                                                if (sibling) sibling.classList.remove('hidden');
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span className="text-white font-semibold text-xs hidden">{msg.sender.name.charAt(0).toUpperCase()}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    <div className="max-w-[75%]">
                                        {/* Sender name with time */}
                                        {!isOwn && isNewSenderGroup && (
                                            <div className="flex items-center gap-2 mb-1 ml-1">
                                                <span className="text-xs text-gray-700 font-medium">{msg.sender.name}</span>
                                                <span className="text-xs text-gray-400">•</span>
                                                <span className="text-xs text-gray-400">{formatMessageTime(msg.createdAt)}</span>
                                            </div>
                                        )}
                                        {/* Time for own messages */}
                                        {isOwn && isNewSenderGroup && (
                                            <div className="flex justify-end mb-1 mr-1">
                                                <span className="text-xs text-gray-400">{formatMessageTime(msg.createdAt)}</span>
                                            </div>
                                        )}
                                        <div className="relative">
                                            <div
                                                className={`px-3 py-2 rounded-2xl ${isOwn ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
                                                    } ${isOwn && isLastInGroup ? 'rounded-br-md' : ''} ${!isOwn && isLastInGroup ? 'rounded-bl-md' : ''} ${longPressMessageId === msg.id ? 'scale-95' : ''}`}
                                                onTouchStart={(e) => {
                                                    const target = e.target as HTMLElement;
                                                    if (target.tagName === 'IMG' || target.tagName === 'BUTTON' || target.tagName === 'A') return;
                                                    longPressTimerRef.current = setTimeout(() => {
                                                        setLongPressMessageId(msg.id);
                                                        setShowReactionPicker(msg.id);
                                                        if (navigator.vibrate) navigator.vibrate(50);
                                                    }, 500);
                                                }}
                                                onTouchEnd={() => {
                                                    if (longPressTimerRef.current) {
                                                        clearTimeout(longPressTimerRef.current);
                                                        longPressTimerRef.current = null;
                                                    }
                                                    setLongPressMessageId(null);
                                                }}
                                                onTouchMove={() => {
                                                    if (longPressTimerRef.current) {
                                                        clearTimeout(longPressTimerRef.current);
                                                        longPressTimerRef.current = null;
                                                    }
                                                    setLongPressMessageId(null);
                                                }}
                                            >
                                                {renderMessage({ ...msg, content: displayContent }, isOwn)}
                                            </div>

                                            {/* Reaction Picker with delete */}
                                            {showReactionPicker === msg.id && (
                                                <>
                                                    <div className="fixed inset-0 z-[9998] bg-black/10" onClick={() => setShowReactionPicker(null)} />
                                                    <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-12 bg-white rounded-full shadow-xl border px-2 py-1 flex items-center gap-1 z-[9999]`}>
                                                        {REACTION_EMOJIS.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleReaction(msg, emoji);
                                                                    setShowReactionPicker(null);
                                                                }}
                                                                className="text-xl p-1 active:scale-125"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                        {isOwn && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setShowReactionPicker(null);
                                                                    deleteMessage(msg.id, conversationId);
                                                                }}
                                                                className="p-1 text-red-500"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Reactions */}
                                        {Object.keys(groupedReactions).length > 0 && (
                                            <div className={`flex gap-0.5 mt-0.5 ${isOwn ? 'justify-end' : ''}`}>
                                                {Object.entries(groupedReactions).map(([emoji, reactions]) => (
                                                    <button
                                                        key={emoji}
                                                        onClick={(e) => { e.stopPropagation(); toggleReaction(msg, emoji); }}
                                                        className={`text-xs px-1 py-0.5 rounded-full ${reactions.some(r => r.userId === user?.id) ? 'bg-blue-100' : 'bg-gray-100'
                                                            }`}
                                                    >
                                                        {emoji}{reactions.length > 1 && reactions.length}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}

                    {/* Typing indicator */}
                    {typingUsers[conversationId] && typingUsers[conversationId].length > 0 && (
                        <div className="flex justify-start">
                            <div className="px-3 py-2 bg-white rounded-2xl border">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Read receipt indicator - mobile version */}
                    {(() => {
                        const win = chatWindows.find(w => w.conversationId === conversationId);
                        const myLastMsg = [...mobileActiveChat.messages].reverse().find(m => m.sender.id === user?.id);
                        const otherMembers = mobileActiveChat.conversation.members.filter((m: ConversationMember) => m.user.id !== user?.id);
                        const hasOtherMembersRead = win?.readBy && Object.keys(win.readBy).some(
                            uid => parseInt(uid) !== user?.id &&
                                myLastMsg &&
                                new Date(win.readBy![parseInt(uid)]) >= new Date(myLastMsg.createdAt)
                        );

                        if (myLastMsg && otherMembers.length > 0) {
                            return (
                                <div className="flex justify-end px-4 py-1">
                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                        {hasOtherMembersRead ? (
                                            <>
                                                <CheckCheck size={14} className="text-blue-500" />
                                                <span className="text-blue-500">Đã xem</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check size={14} />
                                                <span>Đã gửi</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div ref={messagesEndRef} />
                </div>

                {/* Upload Progress */}
                {progress !== undefined && (
                    <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
                        <div className="flex items-center gap-3">
                            <Loader2 size={18} className="animate-spin text-blue-600" />
                            <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-sm font-medium text-blue-600">{progress}%</span>
                        </div>
                    </div>
                )}

                {/* Input - Modern Design */}
                <div className="p-3 bg-white border-t border-gray-100 shrink-0 safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
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
                            <AttachmentPicker
                                token={token || ''}
                                onFilesSelected={(files) => {
                                    if (files.length > 0) {
                                        handleFileUpload(conversationId, files[0]);
                                    }
                                }}
                                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                                multiple={false}
                                buttonClassName="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-full text-gray-500 transition-colors shrink-0"
                                iconSize={20}
                            />
                            <button
                                onClick={() => document.getElementById(`mobile-camera-input-${conversationId}`)?.click()}
                                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-full text-gray-500 transition-colors shrink-0"
                                title="Chụp ảnh từ camera"
                            >
                                <Camera size={20} />
                            </button>

                            {/* Mobile Text Input with Mention Popup */}
                            <div className="relative flex-1 min-w-0">
                                <input
                                    ref={el => { inputRefs.current[conversationId] = el; }}
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => handleInputChange(conversationId, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (showMentionPopup === conversationId) {
                                            const suggestions = getMentionSuggestions(conversationId);
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setShowMentionPopup(null);
                                            } else if (e.key === 'Enter' && suggestions.length > 0) {
                                                e.preventDefault();
                                                insertMention(conversationId, suggestions[0].user.name);
                                            }
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            sendMessage(conversationId, messageInput);
                                        }
                                    }}
                                    placeholder="Nhập tin nhắn..."
                                    className="w-full px-4 py-2.5 bg-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white focus:shadow-sm text-base transition-all border border-transparent focus:border-blue-200"
                                    data-mobile-conversation-id={conversationId}
                                />

                                {/* Mobile Mention Popup */}
                                {showMentionPopup === conversationId && (
                                    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border py-1 z-[9999] w-64 max-h-48 overflow-y-auto">
                                        {getMentionSuggestions(conversationId).length > 0 ? (
                                            getMentionSuggestions(conversationId).map((member) => (
                                                <button
                                                    key={member.user.id}
                                                    onClick={() => insertMention(conversationId, member.user.name)}
                                                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-blue-50 active:bg-blue-100 transition-colors text-left"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                                                        {member.user.avatarUrl ? (
                                                            <img src={resolveAttachmentUrl(member.user.avatarUrl) || ''} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-blue-600 font-medium text-sm">{member.user.name.charAt(0).toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-gray-800 truncate">{member.user.name}</div>
                                                        <div className="text-xs text-gray-500 truncate">{member.user.email}</div>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy người dùng</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Send Button - Gradient Design */}
                            <button
                                onClick={() => sendMessage(conversationId, messageInput)}
                                disabled={!messageInput.trim()}
                                className={`p-2.5 rounded-xl transition-all duration-300 shrink-0 ${messageInput.trim()
                                    ? 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-sm'
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
            </div>
        );
    };

    // ==================== RENDER CREATE GROUP MODAL ====================
    const renderCreateGroupModal = () => {
        if (!showCreateGroup) return null;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl animate-scaleIn">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-2xl">
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
                                            // Open image cropper
                                            const url = URL.createObjectURL(file);
                                            setCropImageUrl(url);
                                            setCropTarget('group');
                                            setShowImageCropper(true);
                                        }
                                    }}
                                />
                                <label
                                    htmlFor="group-avatar-input"
                                    className="w-20 h-20 rounded-2xl bg-blue-100 border-2 border-dashed border-blue-300 flex items-center justify-center cursor-pointer hover:border-blue-400 overflow-hidden transition-all relative group"
                                >
                                    <img id="group-avatar-preview" src="" alt="" className="w-full h-full object-cover hidden" />
                                    <div id="group-avatar-placeholder" className="flex flex-col items-center text-blue-400 group-hover:text-blue-500">
                                        <Camera size={24} />
                                        <span className="text-xs mt-1">Ảnh nhóm</span>
                                    </div>
                                </label>
                            </div>
                            <div className="flex-1 space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tên nhóm <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder="Nhập tên nhóm..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1">Mô tả</label>
                                    <input
                                        type="text"
                                        id="group-description"
                                        placeholder="Mô tả về nhóm..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                                        className={`flex items-center gap-3 p-3 cursor-pointer transition-all ${selectedMembers.some(m => m.id === u.id)
                                            ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                            : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden shadow-sm">
                                            {u.avatarUrl || u.avatar ? (
                                                <img src={resolveAttachmentUrl(u.avatarUrl || u.avatar || null) || ''} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-sm font-semibold text-white">{u.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 truncate">{u.name}</p>
                                            <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedMembers.some(m => m.id === u.id)
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
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
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
            {/* Chat Button - Modern Design */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative p-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm hover:shadow transition-all duration-300 active:scale-95 group"
                >
                    <MessageCircle size={22} className="text-white group-hover:scale-110 transition-transform" />
                    {totalUnread > 0 && (
                        <>
                            {/* Pulse animation */}
                            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full animate-pulse" />
                            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5">
                                {totalUnread > 9 ? '9+' : totalUnread}
                            </span>
                        </>
                    )}
                </button>
            </div>

            {createPortal(<> {/* Chat List Panel - OUTSIDE relative container */}
                {isOpen && (
                    <>
                        {/* Backdrop - click to close */}
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                zIndex: 9998
                            }}
                            onClick={() => setIsOpen(false)}
                        />
                        {/* Chat Panel */}
                        <div
                            style={{
                                position: 'fixed',
                                zIndex: 9999,
                                backgroundColor: 'white',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                ...(isMobile ? {
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    height: '85vh',
                                    borderTopLeftRadius: '16px',
                                    borderTopRightRadius: '16px'
                                } : {
                                    right: '16px',
                                    bottom: '80px',
                                    width: '384px',
                                    height: '500px',
                                    borderRadius: '12px'
                                })
                            }}
                        >
                            {/* Panel Header - Gradient Design */}
                            <div className="bg-blue-600 shrink-0" style={isMobile ? { paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' } : undefined}>
                                <div className="p-4 pb-3">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                                                <MessageCircle size={20} className="text-white" />
                                            </div>
                                            <h3 className="font-bold text-xl text-white">Tin nhắn</h3>
                                            {totalUnread > 0 && (
                                                <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs font-bold rounded-full">
                                                    {totalUnread}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                className="p-2.5 hover:bg-white/20 rounded-xl transition-colors text-white/80 hover:text-white"
                                                title="Cài đặt"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="3" />
                                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowCreateGroup(true);
                                                    fetchAllUsers();
                                                }}
                                                className="p-2.5 hover:bg-white/20 rounded-xl transition-colors text-white/80 hover:text-white"
                                                title="Tạo nhóm mới"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <line x1="19" y1="8" x2="19" y2="14" />
                                                    <line x1="22" y1="11" x2="16" y2="11" />
                                                </svg>
                                            </button>
                                            {isMobile && (
                                                <button
                                                    onClick={() => setIsOpen(false)}
                                                    className="w-10 h-10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-xl transition-colors text-white"
                                                >
                                                    <X size={22} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Search - Glass morphism style */}
                                    <div className="relative">
                                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Tìm kiếm cuộc trò chuyện..."
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:bg-white/30 transition-all border border-white/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Recent conversations label */}
                            <div className="px-4 py-2 text-sm text-gray-500 flex items-center gap-2 bg-white border-b border-gray-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                Trò chuyện gần đây
                            </div>

                            {/* Hidden Tabs - keep for functionality */}
                            <div className="hidden">
                                <button
                                    onClick={() => setSearchMode('conversations')}
                                    className={`flex-1 py-2.5 px-4 text-sm font-medium transition-all rounded-lg flex items-center justify-center gap-2 ${searchMode === 'conversations'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    <MessageSquare size={16} />
                                    Trò chuyện
                                </button>
                                <button
                                    onClick={() => setSearchMode('users')}
                                    className={`flex-1 py-2.5 px-4 text-sm font-medium transition-all rounded-lg flex items-center justify-center gap-2 ${searchMode === 'users'
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
                                                    className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-all group relative ${conv.unreadCount > 0 ? 'bg-blue-50/30' : ''
                                                        } ${pinnedConversations.has(conv.id) ? 'bg-amber-50/50' : ''}`}
                                                >
                                                    {/* Pin indicator */}
                                                    {pinnedConversations.has(conv.id) && (
                                                        <div className="absolute top-1 left-1">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                                                                <line x1="12" y1="17" x2="12" y2="22" />
                                                                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    <div className="flex-1 flex items-center gap-3" onClick={() => openConversation(conv)}>
                                                        <div className="relative shrink-0">
                                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg overflow-hidden ${conv.type === 'GROUP'
                                                                ? 'bg-purple-600'
                                                                : 'bg-blue-600'
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
                                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                                            {conv.unreadCount > 0 && (
                                                                <div className="absolute -top-1 -left-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                                                                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <p className={`font-semibold truncate ${conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
                                                                    }`}>
                                                                    {conv.displayName}
                                                                </p>
                                                                {conv.lastMessage && (
                                                                    <span className={`text-xs shrink-0 ml-2 ${conv.unreadCount > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'
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
                                                                    đang soạn...
                                                                </p>
                                                            ) : conv.lastMessage ? (
                                                                <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                                                                    {conv.lastMessage.senderId === user?.id && <span className="text-gray-400">Bạn: </span>}
                                                                    {conv.lastMessage.messageType === 'VOICE' ? '🎤 Tin nhắn thoại' :
                                                                        conv.lastMessage.messageType === 'IMAGE' ? '🖼️ Hình ảnh' :
                                                                            conv.lastMessage.messageType === 'FILE' ? '📎 Tệp đính kèm' :
                                                                                conv.lastMessage.content ? decryptMessage(conv.lastMessage.content) : ''}
                                                                </p>
                                                            ) : (
                                                                <p className="text-sm text-gray-400 italic">Chưa có tin nhắn</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Menu 3 chấm */}
                                                    <div className="relative shrink-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConversationMenuOpen(conversationMenuOpen === conv.id ? null : conv.id);
                                                            }}
                                                            className="p-1.5 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <MoreVertical size={18} />
                                                        </button>

                                                        {conversationMenuOpen === conv.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-[9998]" onClick={() => setConversationMenuOpen(null)} />
                                                                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[160px] z-[9999]">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setConversationMenuOpen(null);
                                                                            togglePinConversation(conv.id);
                                                                        }}
                                                                        className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-sm"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={pinnedConversations.has(conv.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <line x1="12" y1="17" x2="12" y2="22" />
                                                                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                                                        </svg>
                                                                        {pinnedConversations.has(conv.id) ? 'Bỏ ghim' : 'Ghim cuộc trò chuyện'}
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setConversationMenuOpen(null);
                                                                            deleteConversation(conv.id);
                                                                        }}
                                                                        className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                        Xóa cuộc trò chuyện
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* XEM TẤT CẢ button */}
                                            {filteredConversations.length > 0 && (
                                                <div className="py-3 text-center border-t border-gray-100">
                                                    <button
                                                        onClick={() => setSearchMode('users')}
                                                        className="text-blue-500 hover:text-blue-600 font-medium text-sm"
                                                    >
                                                        TÌM NGƯỜI DÙNG KHÁC
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                ) : (
                                    <>
                                        {/* Back to conversations button */}
                                        <div className="px-4 py-2 border-b border-gray-100">
                                            <button
                                                onClick={() => {
                                                    setSearchMode('conversations');
                                                    setSearchQuery('');
                                                    setSearchUsers([]);
                                                }}
                                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                <ArrowLeft size={16} />
                                                Quay lại trò chuyện gần đây
                                            </button>
                                        </div>
                                        {searchUsers.length === 0 ? (
                                            <div className="text-center py-16 px-6">
                                                <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-4">
                                                    <Users size={32} className="text-purple-400" />
                                                </div>
                                                <p className="text-base font-semibold text-gray-700 mb-1">
                                                    {loading ? 'Đang tải...' : (searchQuery ? 'Không tìm thấy người dùng' : 'Đang tải danh sách...')}
                                                </p>
                                                <p className="text-sm text-gray-400">
                                                    {searchQuery ? 'Thử tìm với từ khóa khác' : 'Vui lòng đợi trong giây lát'}
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
                                                            <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-semibold text-lg overflow-hidden shadow-sm">
                                                                {u.avatarUrl || u.avatar ? (
                                                                    <img src={resolveAttachmentUrl(u.avatarUrl || u.avatar || null) || ''} alt="" className="w-full h-full object-cover" />
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
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Mobile Chat View - Outside relative container */}
                {isMobile && mobileActiveChat && renderMobileChat()}

                {/* Desktop Chat Windows - Outside relative container */}
                {!isMobile && chatWindows.map((w, i) => renderChatWindow(w, i))}

                {/* Create Group Modal */}
                {renderCreateGroupModal()}

                {/* Image Preview Modal with Zoom */}
                {imagePreview && (
                    <ImageViewer
                        src={imagePreview}
                        onClose={() => setImagePreview(null)}
                    />
                )}

                {/* OnlyOffice Viewer */}
                {showOnlyOffice && token && (
                    <DiscussionOnlyOfficeViewer
                        messageId={showOnlyOffice.messageId}
                        fileName={showOnlyOffice.filename}
                        onClose={() => setShowOnlyOffice(null)}
                        token={token}
                        type="chat"
                    />
                )}

                {/* Image Cropper */}
                {showImageCropper && cropImageUrl && (
                    <ImageCropper
                        imageUrl={cropImageUrl}
                        onCrop={(croppedBlob) => {
                            if (cropTarget === 'group') {
                                // Convert blob to file for upload
                                const file = new File([croppedBlob], 'group-avatar.jpg', { type: 'image/jpeg' });
                                (window as any)._groupAvatarFile = file;

                                // Update preview
                                const url = URL.createObjectURL(croppedBlob);
                                const preview = document.getElementById('group-avatar-preview') as HTMLImageElement;
                                const placeholder = document.getElementById('group-avatar-placeholder') as HTMLElement;
                                if (preview && placeholder) {
                                    preview.src = url;
                                    preview.classList.remove('hidden');
                                    placeholder.classList.add('hidden');
                                }
                            }
                            setShowImageCropper(false);
                            setCropImageUrl(null);
                        }}
                        onCancel={() => {
                            setShowImageCropper(false);
                            setCropImageUrl(null);
                        }}
                    />
                )}
            </>, document.body)}
        </>
    );
};

export default ChatPopup;
