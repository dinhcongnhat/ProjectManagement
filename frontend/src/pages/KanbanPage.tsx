import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import api, { API_URL } from '../config/api';
import {
    Plus, X, MoreHorizontal, Users, Calendar, MessageSquare, CheckSquare,
    Trash2, Edit3, ChevronLeft, UserPlus, Clock,
    Star, ShieldCheck, Paperclip, Download, Eye, FileText, Image, Film, HardDrive, FolderOpen
} from 'lucide-react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FilePickerDialog } from '../components/ui/FilePickerDialog';
import type { SelectedFile } from '../components/ui/FilePickerDialog';
import { GoogleDriveBrowser } from '../components/GoogleDrive/GoogleDriveBrowser';
import { GoogleDriveIcon } from '../components/ui/AttachmentPicker';

// ==================== TYPES ====================
interface BoardMember {
    id: number;
    role: string;
    user: {
        id: number;
        name: string;
        avatar?: string;
        avatarUrl?: string;
    };
}

interface KanbanLabel {
    id: number;
    name: string | null;
    color: string;
    boardId: number;
}

interface KanbanCard {
    id: number;
    title: string;
    description: string | null;
    position: number;
    dueDate: string | null;
    completed: boolean;
    approved: boolean;
    approvedById: number | null;
    approvedAt: string | null;
    taskId: number | null;
    projectId: number | null;
    listId: number;
    creatorId: number;
    creator: { id: number; name: string };
    assignees: { id: number; name: string; avatar?: string; avatarUrl?: string }[];
    labels: KanbanLabel[];
    _count: { comments: number; checklist: number; attachments: number };
    checklistTotal: number;
    checklistChecked: number;
}

interface KanbanList {
    id: number;
    title: string;
    position: number;
    boardId: number;
    cards: KanbanCard[];
}

interface KanbanBoard {
    id: number;
    title: string;
    description: string | null;
    background: string;
    isProjectBoard: boolean;
    projectId: number | null;
    ownerId: number;
    owner: { id: number; name: string; avatar?: string; avatarUrl?: string };
    members: BoardMember[];
    labels: KanbanLabel[];
    lists: KanbanList[];
    _count?: { lists: number };
}

interface ChecklistItem {
    id: number;
    title: string;
    checked: boolean;
    position: number;
}

interface Comment {
    id: number;
    content: string;
    createdAt: string;
    author: { id: number; name: string; avatar?: string; avatarUrl?: string };
}

interface KanbanAttachment {
    id: number;
    fileName: string;
    fileSize: number;
    mimeType: string;
    minioPath: string;
    source: string;
    googleDriveFileId?: string;
    googleDriveLink?: string;
    createdAt: string;
    uploadedBy: { id: number; name: string };
}

// ==================== BOARD COLORS ====================
// ==================== KANBAN ONLYOFFICE VIEWER ====================
const KanbanOnlyOfficeViewer: React.FC<{
    attachmentId: number;
    fileName: string;
    onClose: () => void;
}> = ({ attachmentId, fileName, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInstanceRef = useRef<object | null>(null);

    useEffect(() => {
        let cancelled = false;
        const token = localStorage.getItem('token');

        const init = async () => {
            try {
                // Check support
                const checkRes = await fetch(`${API_URL}/onlyoffice/kanban/check/${attachmentId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!checkRes.ok) throw new Error('Không thể kiểm tra file');
                const checkData = await checkRes.json();
                if (!checkData.supported) throw new Error('File này không được hỗ trợ bởi OnlyOffice');

                const onlyofficeUrl = checkData.onlyofficeUrl;

                // Load OnlyOffice script
                if (!window.DocsAPI) {
                    await new Promise<void>((resolve, reject) => {
                        if (window.DocsAPI) return resolve();
                        const script = document.createElement('script');
                        script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;
                        script.async = true;
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Không thể tải OnlyOffice'));
                        document.body.appendChild(script);
                    });
                }

                if (cancelled) return;

                // Get config
                const configRes = await fetch(`${API_URL}/onlyoffice/kanban/config/${attachmentId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!configRes.ok) throw new Error('Không thể tải cấu hình OnlyOffice');
                const configData = await configRes.json();

                if (cancelled || !editorRef.current || !window.DocsAPI) return;

                editorInstanceRef.current = new window.DocsAPI.DocEditor(editorRef.current.id, configData.config);
                setLoading(false);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
                    setLoading(false);
                }
            }
        };

        init();
        return () => { cancelled = true; editorInstanceRef.current = null; };
    }, [attachmentId]);

    return (
        <div className="fixed inset-0 z-[10001] bg-black/90 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-black/40 shrink-0">
                <span className="text-white text-sm font-medium truncate">{fileName}</span>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-3"></div>
                            <p>Đang tải OnlyOffice...</p>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white">
                            <p className="text-red-400 mb-2">{error}</p>
                            <button onClick={onClose} className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600">Đóng</button>
                        </div>
                    </div>
                )}
                <div ref={editorRef} id={`kanban-onlyoffice-editor-${attachmentId}`} className="w-full h-full" />
            </div>
        </div>
    );
};

// Add DocsAPI type declaration
declare global {
    interface Window {
        DocsAPI?: {
            DocEditor: new (elementId: string, config: object) => object;
        };
    }
}

const BOARD_COLORS = [
    '#0079bf', '#d29034', '#519839', '#b04632',
    '#89609e', '#cd5a91', '#4bbf6b', '#00aecc',
    '#838c91', '#1a1a2e'
];

// Helper: resolve relative avatar URLs to absolute API URLs
const resolveAvatarUrl = (avatarUrl: string | null | undefined): string | undefined => {
    if (!avatarUrl) return undefined;
    if (avatarUrl.startsWith('http')) return avatarUrl;
    const base = API_URL.replace('/api', '');
    return `${base}${avatarUrl}`;
};

// ==================== SORTABLE CARD ====================
const MoveCardMenu: React.FC<{
    card: KanbanCard;
    isDark: boolean;
    lists: KanbanList[];
    onMoveCard: (cardId: number, fromListId: number, toListId: number) => void;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLButtonElement | null>;
}> = ({ card, isDark, lists, onMoveCard, onClose, anchorRef }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const menuHeight = (lists.length - 1) * 40 + 40;
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4;
            const left = Math.min(rect.right - 160, window.innerWidth - 168);
            setPos({ top, left: Math.max(8, left) });
        }
    }, [anchorRef, lists.length]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
                anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside as any);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside as any);
        };
    }, [onClose, anchorRef]);

    return ReactDOM.createPortal(
        <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className={`w-40 rounded-lg shadow-xl py-1 border ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
            onClick={(e) => e.stopPropagation()}
        >
            <p className={`px-3 py-1.5 text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Chuyển đến
            </p>
            {lists.filter(l => l.id !== card.listId).map(list => (
                <button
                    key={list.id}
                    onClick={(e) => { e.stopPropagation(); onMoveCard(card.id, card.listId, list.id); onClose(); }}
                    className={`w-full text-left px-3 py-2 text-sm ${isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}`}
                >
                    {list.title}
                </button>
            ))}
        </div>,
        document.body
    );
};

const SortableCard: React.FC<{
    card: KanbanCard;
    isDark: boolean;
    onClick: () => void;
    lists?: KanbanList[];
    onMoveCard?: (cardId: number, fromListId: number, toListId: number) => void;
}> = ({ card, isDark, onClick, lists, onMoveCard }) => {
    const [showMoveMenu, setShowMoveMenu] = useState(false);
    const moveButtonRef = useRef<HTMLButtonElement>(null);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `card-${card.id}`,
        data: { type: 'card', card, listId: card.listId }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2 relative ${isDark ? 'bg-gray-700 hover:bg-gray-650' : 'bg-white hover:bg-gray-50'
                } ${isDragging ? 'ring-2 ring-blue-400' : ''}`}
        >
            {/* Mobile move button */}
            {lists && onMoveCard && (
                <div className="sm:hidden absolute top-2 right-2 z-10">
                    <button
                        ref={moveButtonRef}
                        onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                        className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {showMoveMenu && (
                        <MoveCardMenu
                            card={card}
                            isDark={isDark}
                            lists={lists}
                            onMoveCard={onMoveCard}
                            onClose={() => setShowMoveMenu(false)}
                            anchorRef={moveButtonRef}
                        />
                    )}
                </div>
            )}

            {/* Labels */}
            {card.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {card.labels.map(label => (
                        <span
                            key={label.id}
                            className="inline-block h-2 w-10 rounded-full"
                            style={{ backgroundColor: label.color }}
                            title={label.name || ''}
                        />
                    ))}
                </div>
            )}

            {/* Title */}
            <p className={`text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                {card.title}
            </p>

            {/* Approval status */}
            {card.approved && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-1">
                    <ShieldCheck className="w-3 h-3" /> Đã duyệt
                </span>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
                {card.dueDate && (
                    <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${card.completed
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : new Date(card.dueDate) < new Date()
                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-100 text-gray-600'
                        }`}>
                        <Clock className="w-3 h-3" />
                        {new Date(card.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
                {card.description && (
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <Edit3 className="w-3 h-3" />
                    </span>
                )}
                {card._count.comments > 0 && (
                    <span className={`flex items-center gap-0.5 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <MessageSquare className="w-3 h-3" />
                        {card._count.comments}
                    </span>
                )}
                {card.checklistTotal > 0 && (
                    <span className={`flex items-center gap-0.5 text-xs ${card.checklistChecked === card.checklistTotal
                            ? 'text-green-600' : isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                        <CheckSquare className="w-3 h-3" />
                        {card.checklistChecked}/{card.checklistTotal}
                    </span>
                )}
                {card._count.attachments > 0 && (
                    <span className={`flex items-center gap-0.5 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <Paperclip className="w-3 h-3" />
                        {card._count.attachments}
                    </span>
                )}
            </div>

            {/* Assignees */}
            {card.assignees.length > 0 && (
                <div className="flex justify-end mt-2 -space-x-1">
                    {card.assignees.slice(0, 3).map(a => (
                        <div
                            key={a.id}
                            className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-700"
                            title={a.name}
                        >
                            {a.avatarUrl ? (
                                <img src={resolveAvatarUrl(a.avatarUrl)!} alt={a.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                a.name.charAt(0).toUpperCase()
                            )}
                        </div>
                    ))}
                    {card.assignees.length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-700">
                            +{card.assignees.length - 3}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ==================== SORTABLE LIST ====================
const SortableList: React.FC<{
    list: KanbanList;
    isDark: boolean;
    onCardClick: (card: KanbanCard) => void;
    onAddCard: (listId: number) => void;
    onEditTitle: (listId: number, title: string) => void;
    onDeleteList: (listId: number) => void;
    addingCardToList: number | null;
    newCardTitle: string;
    newCardDueDate: string;
    setNewCardTitle: (v: string) => void;
    setNewCardDueDate: (v: string) => void;
    setAddingCardToList: (v: number | null) => void;
    handleCreateCard: (listId: number) => void;
    allLists?: KanbanList[];
    onMoveCard?: (cardId: number, fromListId: number, toListId: number) => void;
}> = ({ list, isDark, onCardClick, onAddCard, onEditTitle, onDeleteList,
    addingCardToList, newCardTitle, newCardDueDate, setNewCardTitle, setNewCardDueDate, setAddingCardToList, handleCreateCard, allLists, onMoveCard }) => {
        const [editingTitle, setEditingTitle] = useState(false);
        const [titleValue, setTitleValue] = useState(list.title);
        const [showMenu, setShowMenu] = useState(false);

        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging,
        } = useSortable({
            id: `list-${list.id}`,
            data: { type: 'list', list }
        });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.4 : 1,
        };

        return (
            <div
                ref={setNodeRef}
                style={style}
                className={`flex-shrink-0 w-full sm:w-72 rounded-xl flex flex-col max-h-[calc(100vh-180px)] sm:max-h-[calc(100vh-200px)] ${isDark ? 'bg-gray-800' : 'bg-gray-100'
                    }`}
            >
                {/* List Header */}
                <div className="p-3 flex items-center justify-between" {...attributes} {...listeners}>
                    {editingTitle ? (
                        <input
                            autoFocus
                            value={titleValue}
                            onChange={e => setTitleValue(e.target.value)}
                            onBlur={() => {
                                setEditingTitle(false);
                                if (titleValue.trim() && titleValue !== list.title) {
                                    onEditTitle(list.id, titleValue.trim());
                                }
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    setEditingTitle(false);
                                    if (titleValue.trim() && titleValue !== list.title) {
                                        onEditTitle(list.id, titleValue.trim());
                                    }
                                }
                                if (e.key === 'Escape') {
                                    setEditingTitle(false);
                                    setTitleValue(list.title);
                                }
                            }}
                            className={`text-sm font-semibold w-full px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'
                                }`}
                        />
                    ) : (
                        <h3
                            className={`text-sm font-semibold cursor-pointer ${isDark ? 'text-gray-200' : 'text-gray-700'}`}
                            onClick={() => setEditingTitle(true)}
                        >
                            {list.title}
                            <span className={`ml-2 text-xs font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {list.cards.length}
                            </span>
                        </h3>
                    )}
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {showMenu && (
                            <div className={`absolute right-0 top-8 w-48 rounded-lg shadow-lg z-50 py-1 ${isDark ? 'bg-gray-700' : 'bg-white'} border ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                                <button
                                    onClick={() => { onAddCard(list.id); setShowMenu(false); }}
                                    className={`w-full text-left px-4 py-2 text-sm ${isDark ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}`}
                                >
                                    <Plus className="w-4 h-4 inline mr-2" /> Thêm thẻ
                                </button>
                                <button
                                    onClick={() => { onDeleteList(list.id); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                                >
                                    <Trash2 className="w-4 h-4 inline mr-2" /> Xóa danh sách
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-3 pb-2 scrollbar-thin">
                    <SortableContext
                        items={list.cards.map(c => `card-${c.id}`)}
                        strategy={verticalListSortingStrategy}
                    >
                        {list.cards.map(card => (
                            <SortableCard
                                key={card.id}
                                card={card}
                                isDark={isDark}
                                onClick={() => onCardClick(card)}
                                lists={allLists}
                                onMoveCard={onMoveCard}
                            />
                        ))}
                    </SortableContext>

                    {/* Add card form */}
                    {addingCardToList === list.id ? (
                        <div className="mt-1">
                            <textarea
                                autoFocus
                                placeholder="Nhập tiêu đề thẻ..."
                                value={newCardTitle}
                                onChange={e => setNewCardTitle(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleCreateCard(list.id);
                                    }
                                    if (e.key === 'Escape') { setAddingCardToList(null); setNewCardDueDate(''); }
                                }}
                                className={`w-full p-2 rounded-lg text-sm resize-none ${isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-white text-gray-800 placeholder-gray-400'
                                    } border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}
                                rows={2}
                            />
                            <div className="mt-2">
                                <label className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <Clock className="w-3.5 h-3.5" /> Deadline (tùy chọn)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={newCardDueDate}
                                    onChange={e => setNewCardDueDate(e.target.value)}
                                    className={`w-full mt-1 px-2 py-1.5 rounded-lg text-sm ${isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'
                                        } border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    onClick={() => handleCreateCard(list.id)}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                >
                                    Thêm thẻ
                                </button>
                                <button
                                    onClick={() => { setAddingCardToList(null); setNewCardDueDate(''); }}
                                    className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Add card button */}
                {addingCardToList !== list.id && (
                    <button
                        onClick={() => onAddCard(list.id)}
                        className={`mx-3 mb-3 p-2 rounded-lg text-sm flex items-center gap-1 ${isDark
                                ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                            }`}
                    >
                        <Plus className="w-4 h-4" /> Thêm thẻ
                    </button>
                )}
            </div>
        );
    };

// ==================== MAIN COMPONENT ====================
const KanbanPage: React.FC = () => {
    const { resolvedTheme } = useTheme();
    const { user, token } = useAuth();
    const { socketRef, connected } = useWebSocket(token);
    const isDark = resolvedTheme === 'dark';

    // View state
    const [view, setView] = useState<'boards' | 'board'>('boards');
    const [selectedBoard, setSelectedBoard] = useState<KanbanBoard | null>(null);
    const [boards, setBoards] = useState<KanbanBoard[]>([]);
    const [loading, setLoading] = useState(false);

    // Board creation
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [newBoardTitle, setNewBoardTitle] = useState('');
    const [newBoardDescription, setNewBoardDescription] = useState('');
    const [newBoardColor, setNewBoardColor] = useState('#0079bf');

    // List creation
    const [addingList, setAddingList] = useState(false);
    const [newListTitle, setNewListTitle] = useState('');

    // Card creation
    const [addingCardToList, setAddingCardToList] = useState<number | null>(null);
    const [newCardTitle, setNewCardTitle] = useState('');
    const [newCardDueDate, setNewCardDueDate] = useState('');

    // Card detail modal
    const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
    const [cardComments, setCardComments] = useState<Comment[]>([]);
    const [cardChecklist, setCardChecklist] = useState<ChecklistItem[]>([]);
    const [newComment, setNewComment] = useState('');
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [editingCard, setEditingCard] = useState(false);
    const [editCardTitle, setEditCardTitle] = useState('');
    const [editCardDescription, setEditCardDescription] = useState('');
    const [editCardDueDate, setEditCardDueDate] = useState('');

    // Attachments
    const [cardAttachments, setCardAttachments] = useState<KanbanAttachment[]>([]);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [showDrivePicker, setShowDrivePicker] = useState(false);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<KanbanAttachment | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewIsOffice, setPreviewIsOffice] = useState(false);
    const [kanbanOnlyOfficeId, setKanbanOnlyOfficeId] = useState<number | null>(null);
    const attachFileRef = React.useRef<HTMLInputElement>(null);
    const attachMenuRef = React.useRef<HTMLDivElement>(null);

    // Member management
    const [showMembers, setShowMembers] = useState(false);
    const [allUsers, setAllUsers] = useState<{ id: number; name: string; avatar?: string; avatarUrl?: string }[]>([]);
    const [memberSearch, setMemberSearch] = useState('');

    // DnD
    const [, setActiveId] = useState<string | null>(null);
    const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);

    // Mobile column tab
    const [mobileActiveListIndex, setMobileActiveListIndex] = useState(0);
    const mobileColumnRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Check if current user can edit the selected card
    const canEditCard = selectedCard ? (
        selectedCard.creatorId === user?.id || selectedBoard?.ownerId === user?.id || selectedBoard?.members.some(m => m.user.id === user?.id && m.role === 'ADMIN')
    ) : false;

    // Reset mobile active list index when board changes or lists are removed
    useEffect(() => {
        if (selectedBoard) {
            setMobileActiveListIndex(prev =>
                prev >= selectedBoard.lists.length ? Math.max(0, selectedBoard.lists.length - 1) : prev
            );
        } else {
            setMobileActiveListIndex(0);
        }
    }, [selectedBoard?.id, selectedBoard?.lists.length]);

    // Close attachment menu on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
                setShowAttachMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ==================== FETCH ====================
    const fetchBoards = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/kanban/boards');
            setBoards(res.data);
        } catch (error) {
            console.error('Error fetching boards:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchBoard = useCallback(async (boardId: number) => {
        try {
            const res = await api.get(`/kanban/boards/${boardId}`);
            setSelectedBoard(res.data);
        } catch (error) {
            console.error('Error fetching board:', error);
        }
    }, []);

    useEffect(() => {
        fetchBoards();
    }, [fetchBoards]);

    // Listen for realtime board updates from other users via socket
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !connected) return;

        const handleBoardUpdated = (data: { boardId: number }) => {
            // If we're viewing the board that was updated, refresh it
            if (selectedBoard && selectedBoard.id === data.boardId) {
                fetchBoard(data.boardId);
            }
        };

        socket.on('kanban:board_updated', handleBoardUpdated);
        return () => {
            socket.off('kanban:board_updated', handleBoardUpdated);
        };
    }, [socketRef, connected, selectedBoard?.id, fetchBoard]);

    // ==================== BOARD ACTIONS ====================
    const handleCreateBoard = async () => {
        if (!newBoardTitle.trim()) return;
        try {
            await api.post('/kanban/boards', {
                title: newBoardTitle.trim(),
                description: newBoardDescription.trim() || null,
                background: newBoardColor,
            });
            setShowCreateBoard(false);
            setNewBoardTitle('');
            setNewBoardDescription('');
            setNewBoardColor('#0079bf');
            fetchBoards();
        } catch (error) {
            console.error('Error creating board:', error);
        }
    };

    const handleDeleteBoard = async (boardId: number) => {
        if (!confirm('Bạn có chắc muốn xóa bảng này? Tất cả danh sách và thẻ sẽ bị xóa.')) return;
        try {
            await api.delete(`/kanban/boards/${boardId}`);
            if (selectedBoard?.id === boardId) {
                setSelectedBoard(null);
                setView('boards');
            }
            fetchBoards();
        } catch (error) {
            console.error('Error deleting board:', error);
        }
    };

    const openBoard = async (board: KanbanBoard) => {
        setView('board');
        await fetchBoard(board.id);
    };

    // ==================== LIST ACTIONS ====================
    const handleCreateList = async () => {
        if (!newListTitle.trim() || !selectedBoard) return;
        try {
            const res = await api.post(`/kanban/boards/${selectedBoard.id}/lists`, {
                title: newListTitle.trim()
            });
            setSelectedBoard(prev => prev ? {
                ...prev,
                lists: [...prev.lists, { ...res.data, cards: res.data.cards || [] }]
            } : null);
            setNewListTitle('');
            setAddingList(false);
        } catch (error) {
            console.error('Error creating list:', error);
        }
    };

    const handleEditListTitle = async (listId: number, title: string) => {
        try {
            await api.put(`/kanban/lists/${listId}`, { title });
            setSelectedBoard(prev => prev ? {
                ...prev,
                lists: prev.lists.map(l => l.id === listId ? { ...l, title } : l)
            } : null);
        } catch (error) {
            console.error('Error updating list:', error);
        }
    };

    const handleDeleteList = async (listId: number) => {
        if (!confirm('Xóa danh sách này và tất cả thẻ trong đó?')) return;
        try {
            await api.delete(`/kanban/lists/${listId}`);
            setSelectedBoard(prev => prev ? {
                ...prev,
                lists: prev.lists.filter(l => l.id !== listId)
            } : null);
        } catch (error) {
            console.error('Error deleting list:', error);
        }
    };

    // ==================== CARD ACTIONS ====================
    const handleCreateCard = async (listId: number) => {
        if (!newCardTitle.trim()) return;
        try {
            const res = await api.post(`/kanban/lists/${listId}/cards`, {
                title: newCardTitle.trim(),
                dueDate: newCardDueDate || null
            });
            setSelectedBoard(prev => prev ? {
                ...prev,
                lists: prev.lists.map(l => l.id === listId ? {
                    ...l,
                    cards: [...l.cards, res.data]
                } : l)
            } : null);
            setNewCardTitle('');
            setNewCardDueDate('');
            setAddingCardToList(null);
        } catch (error) {
            console.error('Error creating card:', error);
        }
    };

    // Move card to another list (for mobile)
    const handleMoveCard = async (cardId: number, fromListId: number, toListId: number) => {
        if (fromListId === toListId) return;
        try {
            const targetList = selectedBoard?.lists.find(l => l.id === toListId);
            const newPosition = targetList ? targetList.cards.length : 0;

            await api.put(`/kanban/cards/${cardId}`, { listId: toListId, position: newPosition });

            setSelectedBoard(prev => {
                if (!prev) return null;
                const card = prev.lists.find(l => l.id === fromListId)?.cards.find(c => c.id === cardId);
                if (!card) return prev;

                return {
                    ...prev,
                    lists: prev.lists.map(l => {
                        if (l.id === fromListId) {
                            return { ...l, cards: l.cards.filter(c => c.id !== cardId) };
                        }
                        if (l.id === toListId) {
                            return { ...l, cards: [...l.cards, { ...card, listId: toListId }] };
                        }
                        return l;
                    })
                };
            });
        } catch (error) {
            console.error('Error moving card:', error);
        }
    };

    const handleUpdateCard = async () => {
        if (!selectedCard) return;
        try {
            const res = await api.put(`/kanban/cards/${selectedCard.id}`, {
                title: editCardTitle,
                description: editCardDescription || null,
                dueDate: editCardDueDate || null,
            });
            setSelectedBoard(prev => prev ? {
                ...prev,
                lists: prev.lists.map(l => ({
                    ...l,
                    cards: l.cards.map(c => c.id === selectedCard.id ? { ...c, ...res.data } : c)
                }))
            } : null);
            setSelectedCard({ ...selectedCard, ...res.data });
            setEditingCard(false);
        } catch (error) {
            console.error('Error updating card:', error);
        }
    };

    const handleDeleteCard = async (cardId: number) => {
        if (!confirm('Xóa thẻ này?')) return;
        try {
            await api.delete(`/kanban/cards/${cardId}`);
            setSelectedBoard(prev => prev ? {
                ...prev,
                lists: prev.lists.map(l => ({
                    ...l,
                    cards: l.cards.filter(c => c.id !== cardId)
                }))
            } : null);
            setSelectedCard(null);
        } catch (error) {
            console.error('Error deleting card:', error);
        }
    };

    const openCardDetail = async (card: KanbanCard) => {
        setSelectedCard(card);
        setEditCardTitle(card.title);
        setEditCardDescription(card.description || '');
        setEditCardDueDate(card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 16) : '');
        setEditingCard(false);

        // Fetch comments, checklist and attachments
        try {
            const [commentsRes, checklistRes, attachmentsRes] = await Promise.all([
                api.get(`/kanban/cards/${card.id}/comments`),
                api.get(`/kanban/cards/${card.id}/checklist`),
                api.get(`/kanban/cards/${card.id}/attachments`)
            ]);
            setCardComments(commentsRes.data);
            setCardChecklist(checklistRes.data);
            setCardAttachments(attachmentsRes.data);
        } catch (error) {
            console.error('Error fetching card details:', error);
        }
    };

    // ==================== COMMENTS ====================
    const handleAddComment = async () => {
        if (!newComment.trim() || !selectedCard) return;
        try {
            const res = await api.post(`/kanban/cards/${selectedCard.id}/comments`, {
                content: newComment.trim()
            });
            setCardComments(prev => [res.data, ...prev]);
            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        try {
            await api.delete(`/kanban/comments/${commentId}`);
            setCardComments(prev => prev.filter(c => c.id !== commentId));
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    // ==================== CHECKLIST ====================
    const handleAddChecklistItem = async () => {
        if (!newChecklistItem.trim() || !selectedCard) return;
        try {
            const res = await api.post(`/kanban/cards/${selectedCard.id}/checklist`, {
                title: newChecklistItem.trim()
            });
            setCardChecklist(prev => [...prev, res.data]);
            setNewChecklistItem('');
        } catch (error) {
            console.error('Error adding checklist item:', error);
        }
    };

    const handleToggleChecklist = async (item: ChecklistItem) => {
        try {
            const res = await api.put(`/kanban/checklist/${item.id}`, {
                checked: !item.checked
            });
            setCardChecklist(prev => prev.map(c => c.id === item.id ? res.data : c));
        } catch (error) {
            console.error('Error toggling checklist:', error);
        }
    };

    const handleDeleteChecklistItem = async (itemId: number) => {
        try {
            await api.delete(`/kanban/checklist/${itemId}`);
            setCardChecklist(prev => prev.filter(c => c.id !== itemId));
        } catch (error) {
            console.error('Error deleting checklist item:', error);
        }
    };

    // ==================== ATTACHMENTS ====================
    const handleUploadAttachment = async (files: FileList | File[]) => {
        if (!selectedCard || !files || files.length === 0) return;
        setUploadingAttachment(true);
        try {
            const formData = new FormData();
            Array.from(files).forEach(file => formData.append('files', file));
            const res = await api.post(`/kanban/cards/${selectedCard.id}/attachments`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCardAttachments(prev => [...res.data, ...prev]);
        } catch (error) {
            console.error('Error uploading attachment:', error);
        } finally {
            setUploadingAttachment(false);
        }
    };

    const handleAttachFromFolder = async (selectedFiles: SelectedFile[]) => {
        if (!selectedCard || selectedFiles.length === 0) return;
        setUploadingAttachment(true);
        try {
            const res = await api.post(`/kanban/cards/${selectedCard.id}/attachments/from-folder`, {
                files: selectedFiles.map(f => ({
                    id: f.id,
                    name: f.name,
                    mimeType: f.mimeType,
                    size: f.size,
                    minioPath: f.minioPath
                }))
            });
            setCardAttachments(prev => [...res.data, ...prev]);
        } catch (error) {
            console.error('Error attaching from folder:', error);
        } finally {
            setUploadingAttachment(false);
        }
    };

    const handleAttachFromDrive = async (files: File[]) => {
        if (!selectedCard || files.length === 0) return;
        // Google Drive files come as File objects from GoogleDriveBrowser
        // Upload them as regular files
        setUploadingAttachment(true);
        try {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            const res = await api.post(`/kanban/cards/${selectedCard.id}/attachments`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCardAttachments(prev => [...res.data, ...prev]);
        } catch (error) {
            console.error('Error attaching from Drive:', error);
        } finally {
            setUploadingAttachment(false);
            setShowDrivePicker(false);
        }
    };

    const handleDeleteAttachment = async (attachmentId: number) => {
        try {
            await api.delete(`/kanban/attachments/${attachmentId}`);
            setCardAttachments(prev => prev.filter(a => a.id !== attachmentId));
        } catch (error) {
            console.error('Error deleting attachment:', error);
        }
    };

    const handleViewAttachment = async (attachment: KanbanAttachment) => {
        try {
            const res = await api.get(`/kanban/attachments/${attachment.id}/presigned-url`);
            if (res.data.isGoogleDrive) {
                // Google Drive files: open in new tab (external)
                window.open(res.data.url, '_blank');
            } else if (res.data.isOffice) {
                // Office files: open OnlyOffice viewer with kanban attachment
                setPreviewAttachment(attachment);
                setKanbanOnlyOfficeId(attachment.id);
                setPreviewIsOffice(true);
            } else {
                // Images, PDFs, videos etc: show in-app preview modal
                setPreviewAttachment(attachment);
                setPreviewUrl(res.data.url);
                setPreviewIsOffice(false);
            }
        } catch (error) {
            console.error('Error viewing attachment:', error);
        }
    };

    const handleDownloadAttachment = async (attachment: KanbanAttachment) => {
        try {
            const res = await api.get(`/kanban/attachments/${attachment.id}/presigned-url`);
            if (res.data.isGoogleDrive) {
                window.open(res.data.url, '_blank');
            } else {
                const link = document.createElement('a');
                link.href = res.data.url;
                link.download = attachment.fileName;
                link.click();
            }
        } catch (error) {
            console.error('Error downloading attachment:', error);
        }
    };

    const getAttachmentIcon = (fileName: string, mimeType: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            return <Image className="w-4 h-4 text-green-500" />;
        }
        if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'mkv'].includes(ext)) {
            return <Film className="w-4 h-4 text-purple-500" />;
        }
        if (mimeType.includes('pdf') || ext === 'pdf') {
            return <FileText className="w-4 h-4 text-red-500" />;
        }
        if (mimeType.includes('word') || mimeType.includes('document') || ['doc', 'docx'].includes(ext)) {
            return <FileText className="w-4 h-4 text-blue-600" />;
        }
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) {
            return <FileText className="w-4 h-4 text-green-600" />;
        }
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
            return <FileText className="w-4 h-4 text-orange-500" />;
        }
        return <FileText className="w-4 h-4 text-gray-500" />;
    };

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // ==================== MEMBERS ====================
    const fetchAllUsers = async () => {
        try {
            const res = await api.get('/users');
            setAllUsers(res.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleAddMember = async (userId: number) => {
        if (!selectedBoard) return;
        try {
            const res = await api.post(`/kanban/boards/${selectedBoard.id}/members`, {
                memberIds: [userId]
            });
            setSelectedBoard(prev => prev ? { ...prev, members: res.data } : null);
        } catch (error) {
            console.error('Error adding member:', error);
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!selectedBoard) return;
        try {
            await api.delete(`/kanban/boards/${selectedBoard.id}/members/${userId}`);
            setSelectedBoard(prev => prev ? {
                ...prev,
                members: prev.members.filter(m => m.user.id !== userId)
            } : null);
        } catch (error) {
            console.error('Error removing member:', error);
        }
    };

    // ==================== DRAG & DROP ====================
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);

        if (String(active.id).startsWith('card-')) {
            const cardId = Number(String(active.id).replace('card-', ''));
            for (const list of selectedBoard?.lists || []) {
                const card = list.cards.find(c => c.id === cardId);
                if (card) {
                    setActiveCard(card);
                    break;
                }
            }
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || !selectedBoard) return;

        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);

        // Only handle card movements
        if (!activeIdStr.startsWith('card-')) return;

        const activeCardId = Number(activeIdStr.replace('card-', ''));

        // Find source list
        let sourceListId = -1;
        for (const list of selectedBoard.lists) {
            if (list.cards.some(c => c.id === activeCardId)) {
                sourceListId = list.id;
                break;
            }
        }

        // Determine target list
        let targetListId = -1;
        if (overIdStr.startsWith('list-')) {
            targetListId = Number(overIdStr.replace('list-', ''));
        } else if (overIdStr.startsWith('card-')) {
            const overCardId = Number(overIdStr.replace('card-', ''));
            for (const list of selectedBoard.lists) {
                if (list.cards.some(c => c.id === overCardId)) {
                    targetListId = list.id;
                    break;
                }
            }
        }

        if (sourceListId === -1 || targetListId === -1 || sourceListId === targetListId) return;

        // Move card between lists in local state
        setSelectedBoard(prev => {
            if (!prev) return null;
            const newLists = prev.lists.map(list => {
                if (list.id === sourceListId) {
                    return { ...list, cards: list.cards.filter(c => c.id !== activeCardId) };
                }
                if (list.id === targetListId) {
                    const cardToMove = prev.lists
                        .find(l => l.id === sourceListId)
                        ?.cards.find(c => c.id === activeCardId);
                    if (!cardToMove) return list;

                    const overIndex = overIdStr.startsWith('card-')
                        ? list.cards.findIndex(c => c.id === Number(overIdStr.replace('card-', '')))
                        : list.cards.length;

                    const newCards = [...list.cards];
                    newCards.splice(overIndex >= 0 ? overIndex : list.cards.length, 0, {
                        ...cardToMove,
                        listId: targetListId
                    });
                    return { ...list, cards: newCards };
                }
                return list;
            });
            return { ...prev, lists: newLists };
        });
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveCard(null);

        if (!over || !selectedBoard) return;

        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);

        // Handle list reordering
        if (activeIdStr.startsWith('list-') && overIdStr.startsWith('list-')) {
            const activeListId = Number(activeIdStr.replace('list-', ''));
            const overListId = Number(overIdStr.replace('list-', ''));

            if (activeListId !== overListId) {
                const oldIndex = selectedBoard.lists.findIndex(l => l.id === activeListId);
                const newIndex = selectedBoard.lists.findIndex(l => l.id === overListId);

                const newLists = arrayMove(selectedBoard.lists, oldIndex, newIndex);
                setSelectedBoard(prev => prev ? { ...prev, lists: newLists } : null);

                try {
                    await api.put(`/kanban/boards/${selectedBoard.id}/lists/reorder`, {
                        listIds: newLists.map(l => l.id)
                    });
                } catch (error) {
                    console.error('Error reordering lists:', error);
                    fetchBoard(selectedBoard.id);
                }
            }
            return;
        }

        // Handle card reordering/moving
        if (activeIdStr.startsWith('card-')) {
            const activeCardId = Number(activeIdStr.replace('card-', ''));

            // Determine original list (from active.data)
            const originalListId = (active.data.current as any)?.listId;

            // Find which list the card is now in (after handleDragOver moved it in state)
            for (const list of selectedBoard.lists) {
                const cardIndex = list.cards.findIndex(c => c.id === activeCardId);
                if (cardIndex >= 0) {
                    // Reorder within the list
                    if (overIdStr.startsWith('card-')) {
                        const overCardId = Number(overIdStr.replace('card-', ''));
                        const overIndex = list.cards.findIndex(c => c.id === overCardId);

                        if (overIndex >= 0 && cardIndex !== overIndex) {
                            const newCards = arrayMove(list.cards, cardIndex, overIndex);
                            setSelectedBoard(prev => prev ? {
                                ...prev,
                                lists: prev.lists.map(l => l.id === list.id ? { ...l, cards: newCards } : l)
                            } : null);
                        }
                    }

                    // Check if card moved to a different list
                    const movedToNewList = originalListId && originalListId !== list.id;

                    try {
                        if (movedToNewList) {
                            // Use moveCard endpoint for cross-list moves (triggers workflow notifications)
                            await api.put(`/kanban/cards/${activeCardId}/move`, {
                                targetListId: list.id,
                                position: cardIndex
                            });
                        } else {
                            // Use reorder endpoint for same-list moves
                            await api.put(`/kanban/lists/${list.id}/cards/reorder`, {
                                cardIds: list.cards.map(c => c.id)
                            });
                        }
                    } catch (error: any) {
                        console.error('Error moving card:', error);
                        // Show error message for workflow blocks (e.g., not approved)
                        if (error?.response?.data?.message) {
                            alert(error.response.data.message);
                        }
                        // Revert by refetching board state
                        fetchBoard(selectedBoard.id);
                    }
                    break;
                }
            }
        }
    };

    // ==================== RENDER BOARDS LIST ====================
    const renderBoardsList = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className={`text-2xl lg:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Làm việc nhóm
                    </h2>
                    <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Quản lý công việc nhóm với bảng Kanban</p>
                </div>
                <button
                    onClick={() => setShowCreateBoard(true)}
                    className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm font-medium"
                >
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Tạo bảng mới</span><span className="sm:hidden">Tạo mới</span>
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : boards.length === 0 ? (
                <div className={`text-center py-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Star className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Chưa có bảng nào</p>
                    <p className="text-sm mt-1">Tạo bảng mới để bắt đầu quản lý công việc nhóm</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {boards.map(board => (
                        <div
                            key={board.id}
                            onClick={() => openBoard(board)}
                            className="relative group cursor-pointer rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 h-24 sm:h-32"
                            style={{ backgroundColor: board.background || '#0079bf' }}
                        >
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                            <div className="relative p-3 sm:p-4 h-full flex flex-col justify-between">
                                <div>
                                    <h3 className="text-white font-bold text-sm sm:text-lg truncate">{board.title}</h3>
                                    {board.description && (
                                        <p className="text-white/80 text-xs mt-1 line-clamp-1 sm:line-clamp-2 hidden sm:block">{board.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/70" />
                                    <span className="text-white/70 text-[10px] sm:text-xs">{board.members?.length || 0} thành viên</span>
                                </div>
                            </div>
                            {board.ownerId === user?.id && (
                                <button
                                    onClick={e => { e.stopPropagation(); handleDeleteBoard(board.id); }}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Board Modal */}
            {showCreateBoard && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
                    <div className={`w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <div className="p-4 sm:p-6">
                            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Tạo bảng mới
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Tiêu đề bảng *
                                    </label>
                                    <input
                                        autoFocus
                                        value={newBoardTitle}
                                        onChange={e => setNewBoardTitle(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateBoard(); }}
                                        placeholder="Nhập tiêu đề..."
                                        className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark
                                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Mô tả
                                    </label>
                                    <textarea
                                        value={newBoardDescription}
                                        onChange={e => setNewBoardDescription(e.target.value)}
                                        placeholder="Mô tả bảng (tùy chọn)..."
                                        rows={2}
                                        className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${isDark
                                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Màu nền
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {BOARD_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewBoardColor(color)}
                                                className={`w-8 h-8 rounded-lg transition-transform ${newBoardColor === color ? 'ring-2 ring-white ring-offset-2 scale-110' : 'hover:scale-105'
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowCreateBoard(false)}
                                    className={`px-4 py-2 rounded-lg text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleCreateBoard}
                                    disabled={!newBoardTitle.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                                >
                                    Tạo bảng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // ==================== RENDER BOARD VIEW ====================
    const renderBoardView = () => {
        if (!selectedBoard) return <div className="p-6">Đang tải...</div>;

        return (
            <div className="flex flex-col h-full">
                {/* Board Header */}
                <div className={`flex items-center gap-2 px-2 sm:px-4 py-2 sm:py-3 border-b ${isDark ? 'border-gray-700 bg-gray-800/80' : 'border-gray-200 bg-white/80'} backdrop-blur-sm`}>
                    <button
                        onClick={() => { setView('boards'); setSelectedBoard(null); }}
                        className={`p-1 sm:p-1.5 rounded-lg shrink-0 ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className={`text-sm sm:text-lg font-bold truncate flex-1 min-w-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {selectedBoard.title}
                    </h2>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {/* Members - hidden on small screens */}
                        <div className="hidden md:flex -space-x-2 mr-2">
                            {selectedBoard.members.slice(0, 5).map(m => (
                                <div
                                    key={m.user.id}
                                    className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800"
                                    title={m.user.name}
                                >
                                    {m.user.avatarUrl ? (
                                        <img src={resolveAvatarUrl(m.user.avatarUrl)} alt={m.user.name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        m.user.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => { setShowMembers(true); fetchAllUsers(); }}
                            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm ${isDark
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Mời</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Column Tabs */}
                {selectedBoard.lists.length > 0 && (
                    <div className={`sm:hidden flex items-center gap-1 px-2 py-2 overflow-x-auto border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`} style={{ WebkitOverflowScrolling: 'touch' }}>
                        {selectedBoard.lists.map((list, idx) => (
                            <button
                                key={list.id}
                                onClick={() => setMobileActiveListIndex(idx)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                    mobileActiveListIndex === idx
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                                {list.title}
                                <span className={`ml-1 ${mobileActiveListIndex === idx ? 'text-blue-100' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {list.cards.length}
                                </span>
                            </button>
                        ))}
                        <button
                            onClick={() => setAddingList(true)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                        >
                            <Plus className="w-3 h-3 inline" />
                        </button>
                    </div>
                )}

                {/* Board Content - Desktop: horizontal scroll, Mobile: single column with swipe */}
                <div className="flex-1 overflow-hidden sm:overflow-y-hidden sm:overflow-x-auto p-2 sm:p-4 sm:scroll-smooth">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        {/* Desktop: horizontal row of columns */}
                        <div className="hidden sm:flex flex-row gap-4 h-full items-start pb-0">
                            <SortableContext
                                items={selectedBoard.lists.map(l => `list-${l.id}`)}
                                strategy={horizontalListSortingStrategy}
                            >
                                {selectedBoard.lists.map(list => (
                                    <SortableList
                                        key={list.id}
                                        list={list}
                                        isDark={isDark}
                                        onCardClick={openCardDetail}
                                        onAddCard={(listId) => {
                                            setAddingCardToList(listId);
                                            setNewCardTitle('');
                                            setNewCardDueDate('');
                                        }}
                                        onEditTitle={handleEditListTitle}
                                        onDeleteList={handleDeleteList}
                                        addingCardToList={addingCardToList}
                                        newCardTitle={newCardTitle}
                                        newCardDueDate={newCardDueDate}
                                        setNewCardTitle={setNewCardTitle}
                                        setNewCardDueDate={setNewCardDueDate}
                                        setAddingCardToList={setAddingCardToList}
                                        handleCreateCard={handleCreateCard}
                                        allLists={selectedBoard.lists}
                                        onMoveCard={handleMoveCard}
                                    />
                                ))}
                            </SortableContext>

                            {/* Add list - desktop */}
                            <div className="flex-shrink-0 w-72">
                                {addingList ? (
                                    <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                        <input
                                            autoFocus
                                            value={newListTitle}
                                            onChange={e => setNewListTitle(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleCreateList();
                                                if (e.key === 'Escape') setAddingList(false);
                                            }}
                                            placeholder="Nhập tiêu đề danh sách..."
                                            className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark
                                                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                                                }`}
                                        />
                                        <div className="flex items-center gap-2 mt-2">
                                            <button
                                                onClick={handleCreateList}
                                                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                            >
                                                Thêm danh sách
                                            </button>
                                            <button
                                                onClick={() => setAddingList(false)}
                                                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setAddingList(true)}
                                        className={`w-full p-3 rounded-xl text-sm flex items-center gap-2 ${isDark
                                                ? 'bg-gray-800/60 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                                : 'bg-gray-100/80 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                            }`}
                                    >
                                        <Plus className="w-4 h-4" /> Thêm danh sách
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Mobile: single column view with swipe */}
                        <div
                            ref={mobileColumnRef}
                            className="sm:hidden flex flex-col h-full overflow-y-auto"
                            onTouchStart={(e) => {
                                const touch = e.touches[0];
                                const ref = mobileColumnRef.current as any;
                                if (ref) {
                                    ref.__touchStartX = touch.clientX;
                                    ref.__touchStartY = touch.clientY;
                                }
                            }}
                            onTouchEnd={(e) => {
                                const ref = mobileColumnRef.current as any;
                                if (!ref?.__touchStartX) return;
                                const touch = e.changedTouches[0];
                                const deltaX = touch.clientX - ref.__touchStartX;
                                const deltaY = touch.clientY - ref.__touchStartY;
                                // Only trigger horizontal swipe if deltaX > deltaY (not scrolling vertically)
                                if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                                    if (deltaX < 0 && mobileActiveListIndex < (selectedBoard?.lists.length || 1) - 1) {
                                        setMobileActiveListIndex(prev => prev + 1);
                                    } else if (deltaX > 0 && mobileActiveListIndex > 0) {
                                        setMobileActiveListIndex(prev => prev - 1);
                                    }
                                }
                                ref.__touchStartX = null;
                                ref.__touchStartY = null;
                            }}
                        >
                            <SortableContext
                                items={selectedBoard.lists[mobileActiveListIndex]?.cards.map(c => `card-${c.id}`) || []}
                                strategy={verticalListSortingStrategy}
                            >
                                {selectedBoard.lists[mobileActiveListIndex] && (
                                    <SortableList
                                        key={selectedBoard.lists[mobileActiveListIndex].id}
                                        list={selectedBoard.lists[mobileActiveListIndex]}
                                        isDark={isDark}
                                        onCardClick={openCardDetail}
                                        onAddCard={(listId) => {
                                            setAddingCardToList(listId);
                                            setNewCardTitle('');
                                            setNewCardDueDate('');
                                        }}
                                        onEditTitle={handleEditListTitle}
                                        onDeleteList={handleDeleteList}
                                        addingCardToList={addingCardToList}
                                        newCardTitle={newCardTitle}
                                        newCardDueDate={newCardDueDate}
                                        setNewCardTitle={setNewCardTitle}
                                        setNewCardDueDate={setNewCardDueDate}
                                        setAddingCardToList={setAddingCardToList}
                                        handleCreateCard={handleCreateCard}
                                        allLists={selectedBoard.lists}
                                        onMoveCard={handleMoveCard}
                                    />
                                )}
                            </SortableContext>

                            {/* Mobile add list */}
                            {addingList && (
                                <div className={`p-3 rounded-xl mt-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                    <input
                                        autoFocus
                                        value={newListTitle}
                                        onChange={e => setNewListTitle(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleCreateList();
                                            if (e.key === 'Escape') setAddingList(false);
                                        }}
                                        placeholder="Nhập tiêu đề danh sách..."
                                        className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark
                                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                                            }`}
                                    />
                                    <div className="flex items-center gap-2 mt-2">
                                        <button
                                            onClick={handleCreateList}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                        >
                                            Thêm
                                        </button>
                                        <button
                                            onClick={() => setAddingList(false)}
                                            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Swipe hint */}
                            {selectedBoard.lists.length > 1 && (
                                <div className={`text-center py-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    ← Vuốt để chuyển cột →
                                </div>
                            )}
                        </div>

                        {/* Drag Overlay */}
                        <DragOverlay>
                            {activeCard && (
                                <div className={`p-3 rounded-lg shadow-xl w-[80vw] sm:w-72 ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                                    <p className={`text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                                        {activeCard.title}
                                    </p>
                                </div>
                            )}
                        </DragOverlay>
                    </DndContext>
                </div>

                {/* Members Modal */}
                {showMembers && (
                    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
                        <div className={`w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                            {/* Mobile drag handle */}
                            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-2 sm:hidden" />
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Thành viên</h3>
                                <button onClick={() => setShowMembers(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4">
                                <input
                                    value={memberSearch}
                                    onChange={e => setMemberSearch(e.target.value)}
                                    placeholder="Tìm kiếm người dùng..."
                                    className={`w-full px-3 py-2 rounded-lg border text-sm mb-3 ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                                        }`}
                                />

                                {/* Current members */}
                                <div className="mb-4">
                                    <h4 className={`text-xs font-semibold uppercase mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Thành viên hiện tại ({selectedBoard.members.length})
                                    </h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {selectedBoard.members.map(m => (
                                            <div key={m.user.id} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                                                        {m.user.avatarUrl ? (
                                                            <img src={resolveAvatarUrl(m.user.avatarUrl)} alt={m.user.name} className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            m.user.name.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{m.user.name}</p>
                                                        <p className="text-xs text-gray-500">{m.role === 'ADMIN' ? 'Admin' : 'Thành viên'}</p>
                                                    </div>
                                                </div>
                                                {m.user.id !== selectedBoard.ownerId && selectedBoard.ownerId === user?.id && (
                                                    <button
                                                        onClick={() => handleRemoveMember(m.user.id)}
                                                        className="text-red-500 hover:text-red-700 text-xs"
                                                    >
                                                        Xóa
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Add members */}
                                <h4 className={`text-xs font-semibold uppercase mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Thêm thành viên
                                </h4>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {allUsers
                                        .filter(u => !selectedBoard.members.some(m => m.user.id === u.id))
                                        .filter(u => u.name.toLowerCase().includes(memberSearch.toLowerCase()))
                                        .map(u => (
                                            <div key={u.id} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                                                        {u.avatarUrl ? (
                                                            <img src={resolveAvatarUrl(u.avatarUrl)} alt={u.name} className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            u.name.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{u.name}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleAddMember(u.id)}
                                                    className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                                                >
                                                    Thêm
                                                </button>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Card Detail Modal */}
                {selectedCard && (
                    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-start justify-center z-50 sm:pt-10 sm:pb-10 sm:overflow-y-auto" onClick={() => setSelectedCard(null)}>
                        <div onClick={e => e.stopPropagation()} className={`w-full sm:max-w-2xl sm:mx-4 rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[95dvh] sm:max-h-[85vh] overflow-y-auto overscroll-contain ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                            {/* Card Header */}
                            <div className={`p-4 sm:p-6 pb-2 sticky top-0 z-10 rounded-t-2xl sm:rounded-t-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
                                {/* Mobile drag handle */}
                                <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        {editingCard ? (
                                            <input
                                                autoFocus
                                                value={editCardTitle}
                                                onChange={e => setEditCardTitle(e.target.value)}
                                                className={`w-full text-lg sm:text-xl font-bold px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}
                                            />
                                        ) : (
                                            <h2
                                                className={`text-lg sm:text-xl font-bold ${canEditCard ? 'cursor-pointer hover:underline' : ''} ${isDark ? 'text-white' : 'text-gray-900'}`}
                                                onClick={() => canEditCard && setEditingCard(true)}
                                            >
                                                {selectedCard.title}
                                            </h2>
                                        )}
                                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            trong danh sách <strong>{selectedBoard.lists.find(l => l.cards.some(c => c.id === selectedCard.id))?.title}</strong>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedCard(null)}
                                        className={`p-2 rounded-lg shrink-0 ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Labels */}
                                {selectedCard.labels.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {selectedCard.labels.map(label => (
                                            <span
                                                key={label.id}
                                                className="inline-block px-3 py-1 rounded-full text-xs text-white font-medium"
                                                style={{ backgroundColor: label.color }}
                                            >
                                                {label.name || 'Nhãn'}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col md:grid md:grid-cols-3 gap-4 p-4 sm:p-6 pt-2">
                                {/* Main content */}
                                <div className="md:col-span-2 space-y-6">
                                    {/* Description */}
                                    <div>
                                        <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            <Edit3 className="w-4 h-4" /> Mô tả
                                        </h3>
                                        {editingCard ? (
                                            <textarea
                                                value={editCardDescription}
                                                onChange={e => setEditCardDescription(e.target.value)}
                                                placeholder="Thêm mô tả..."
                                                rows={4}
                                                className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${isDark
                                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                        : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400'
                                                    }`}
                                            />
                                        ) : (
                                            <div
                                                onClick={() => {
                                                    if (selectedCard.creatorId === user?.id || selectedBoard?.ownerId === user?.id || selectedBoard?.members.some(m => m.user.id === user?.id && m.role === 'ADMIN')) {
                                                        setEditingCard(true);
                                                    }
                                                }}
                                                className={`text-sm min-h-[60px] p-3 rounded-lg ${(selectedCard.creatorId === user?.id || selectedBoard?.ownerId === user?.id || selectedBoard?.members.some(m => m.user.id === user?.id && m.role === 'ADMIN')) ? 'cursor-pointer' : ''} ${isDark
                                                        ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                    }`}
                                            >
                                                {selectedCard.description || (selectedCard.creatorId === user?.id || selectedBoard?.ownerId === user?.id ? 'Nhấp để thêm mô tả...' : 'Chưa có mô tả')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Due date */}
                                    {editingCard && (
                                        <div>
                                            <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                <Calendar className="w-4 h-4" /> Ngày đến hạn
                                            </h3>
                                            <input
                                                type="datetime-local"
                                                value={editCardDueDate}
                                                onChange={e => setEditCardDueDate(e.target.value)}
                                                className={`px-3 py-2 rounded-lg border text-sm ${isDark
                                                        ? 'bg-gray-700 border-gray-600 text-white'
                                                        : 'bg-white border-gray-300 text-gray-800'
                                                    }`}
                                            />
                                        </div>
                                    )}

                                    {editingCard && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleUpdateCard}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                            >
                                                Lưu
                                            </button>
                                            <button
                                                onClick={() => setEditingCard(false)}
                                                className={`px-4 py-2 rounded-lg text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                Hủy
                                            </button>
                                        </div>
                                    )}

                                    {/* Checklist */}
                                    <div>
                                        <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            <CheckSquare className="w-4 h-4" /> Danh sách công việc
                                            {cardChecklist.length > 0 && (
                                                <span className="text-xs font-normal text-gray-500">
                                                    ({cardChecklist.filter(c => c.checked).length}/{cardChecklist.length})
                                                </span>
                                            )}
                                        </h3>

                                        {/* Progress bar */}
                                        {cardChecklist.length > 0 && (
                                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-3">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full transition-all"
                                                    style={{ width: `${(cardChecklist.filter(c => c.checked).length / cardChecklist.length) * 100}%` }}
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-1.5">
                                            {cardChecklist.map(item => (
                                                <div key={item.id} className={`flex items-center gap-2 p-1.5 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={item.checked}
                                                        onChange={() => handleToggleChecklist(item)}
                                                        className="w-4 h-4 rounded border-2 border-gray-400 dark:border-gray-500 text-blue-600 bg-white dark:bg-gray-600 cursor-pointer accent-blue-600"
                                                    />
                                                    <span className={`text-sm flex-1 ${item.checked ? 'line-through text-gray-400' : isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                        {item.title}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteChecklistItem(item.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex gap-2 mt-2">
                                            <input
                                                value={newChecklistItem}
                                                onChange={e => setNewChecklistItem(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddChecklistItem(); }}
                                                placeholder="Thêm mục..."
                                                className={`flex-1 px-3 py-1.5 rounded-lg border text-sm ${isDark
                                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                        : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                                                    }`}
                                            />
                                            <button
                                                onClick={handleAddChecklistItem}
                                                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                            >
                                                Thêm
                                            </button>
                                        </div>
                                    </div>

                                    {/* Comments */}
                                    <div>
                                        <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            <MessageSquare className="w-4 h-4" /> Bình luận ({cardComments.length})
                                        </h3>

                                        <div className="flex gap-2 mb-3">
                                            <textarea
                                                value={newComment}
                                                onChange={e => setNewComment(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                                                placeholder="Viết bình luận..."
                                                rows={2}
                                                className={`flex-1 px-3 py-2 rounded-lg border text-sm resize-none ${isDark
                                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                        : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                                                    }`}
                                            />
                                        </div>
                                        {newComment.trim() && (
                                            <button
                                                onClick={handleAddComment}
                                                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 mb-3"
                                            >
                                                Gửi
                                            </button>
                                        )}

                                        <div className="space-y-3 max-h-60 overflow-y-auto">
                                            {cardComments.map(comment => (
                                                <div key={comment.id} className={`p-2.5 sm:p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shrink-0">
                                                                {comment.author.avatarUrl ? (
                                                                    <img src={resolveAvatarUrl(comment.author.avatarUrl)} alt={comment.author.name} className="w-full h-full rounded-full object-cover" />
                                                                ) : (
                                                                    comment.author.name.charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <span className={`text-xs sm:text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                {comment.author.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(comment.createdAt).toLocaleDateString('vi-VN', {
                                                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                                })}
                                                            </span>
                                                            {comment.author.id === user?.id && (
                                                                <button
                                                                    onClick={() => handleDeleteComment(comment.id)}
                                                                    className="text-red-400 hover:text-red-600"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        {comment.content}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Attachments */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                <Paperclip className="w-4 h-4" /> Đính kèm ({cardAttachments.length})
                                            </h3>
                                            <div className="relative" ref={attachMenuRef}>
                                                <input
                                                    ref={attachFileRef}
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    onChange={e => {
                                                        if (e.target.files) handleUploadAttachment(e.target.files);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <button
                                                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                                                    disabled={uploadingAttachment}
                                                    className={`px-2 py-1 rounded text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                >
                                                    {uploadingAttachment ? 'Đang tải...' : '+ Thêm'}
                                                </button>
                                                {showAttachMenu && (
                                                    <div className={`absolute right-0 top-full mt-1 rounded-lg shadow-xl border z-50 py-1 min-w-[180px] ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                                                        <button
                                                            onClick={() => { setShowAttachMenu(false); attachFileRef.current?.click(); }}
                                                            className={`w-full px-3 py-2 text-left flex items-center gap-2 text-sm ${isDark ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}
                                                        >
                                                            <HardDrive size={16} className="text-blue-500" />
                                                            File từ thiết bị
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowAttachMenu(false); setShowFilePicker(true); }}
                                                            className={`w-full px-3 py-2 text-left flex items-center gap-2 text-sm ${isDark ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}
                                                        >
                                                            <FolderOpen size={16} className="text-amber-500" />
                                                            Từ Kho dữ liệu
                                                        </button>
                                                        <div className={`border-t my-1 ${isDark ? 'border-gray-600' : 'border-gray-100'}`}></div>
                                                        <button
                                                            onClick={() => { setShowAttachMenu(false); setShowDrivePicker(true); }}
                                                            className={`w-full px-3 py-2 text-left flex items-center gap-2 text-sm ${isDark ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}
                                                        >
                                                            <GoogleDriveIcon size={16} />
                                                            Google Drive
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {cardAttachments.length > 0 ? (
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {cardAttachments.map(attachment => (
                                                    <div key={attachment.id} className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg group ${isDark ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                                        <div className="shrink-0">
                                                            {getAttachmentIcon(attachment.fileName, attachment.mimeType)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-xs sm:text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                {attachment.fileName}
                                                            </p>
                                                            <p className="text-[10px] sm:text-xs text-gray-500">
                                                                {formatFileSize(attachment.fileSize)} • {attachment.uploadedBy.name}
                                                                {attachment.source === 'google-drive' && ' • GDrive'}
                                                                {attachment.source === 'folder' && ' • Kho'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleViewAttachment(attachment)}
                                                                className={`p-1.5 rounded ${isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                                                                title="Xem"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadAttachment(attachment)}
                                                                className={`p-1.5 rounded ${isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                                                                title="Tải xuống"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                            </button>
                                                            {(attachment.uploadedBy.id === user?.id || selectedBoard?.ownerId === user?.id) && (
                                                                <button
                                                                    onClick={() => handleDeleteAttachment(attachment.id)}
                                                                    className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                                                    title="Xóa"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className={`text-sm italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                Chưa có file đính kèm
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Sidebar actions - horizontal on mobile, vertical on desktop */}
                                <div className="md:space-y-2">
                                    <h4 className={`text-xs font-semibold uppercase mb-2 hidden md:block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Hành động
                                    </h4>
                                    {/* Mobile: horizontal scroll action bar */}
                                    <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0">
                                        {(selectedCard.creatorId === user?.id || selectedBoard?.ownerId === user?.id || selectedBoard?.members.some(m => m.user.id === user?.id && m.role === 'ADMIN')) && (
                                            <button
                                                onClick={() => setEditingCard(true)}
                                                className={`shrink-0 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                            >
                                                <Edit3 className="w-4 h-4" /> Chỉnh sửa
                                            </button>
                                        )}
                                        {/* Approve button - for board owner/admin/card creator */}
                                        {!selectedCard.approved && selectedBoard && (selectedBoard.ownerId === user?.id || selectedBoard.members.some(m => m.user.id === user?.id && m.role === 'ADMIN') || selectedCard.creator?.id === user?.id) && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await api.put(`/kanban/cards/${selectedCard.id}/approve`);
                                                        setSelectedCard({ ...selectedCard, approved: true, approvedById: user?.id || null, approvedAt: new Date().toISOString() });
                                                        fetchBoard(selectedBoard.id);
                                                    } catch (err: any) {
                                                        alert(err?.response?.data?.message || 'Lỗi khi duyệt');
                                                    }
                                                }}
                                                className="shrink-0 px-3 py-2 rounded-lg text-sm flex items-center gap-2 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                                            >
                                                <ShieldCheck className="w-4 h-4" /> Duyệt
                                            </button>
                                        )}
                                        {selectedCard.approved && (
                                            <div className="shrink-0 px-3 py-2 rounded-lg text-sm flex items-center gap-2 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                                <ShieldCheck className="w-4 h-4" /> Đã duyệt
                                            </div>
                                        )}
                                        {(selectedCard.creatorId === user?.id || selectedBoard?.ownerId === user?.id || selectedBoard?.members.some(m => m.user.id === user?.id && m.role === 'ADMIN')) && (
                                            <button
                                                onClick={() => handleDeleteCard(selectedCard.id)}
                                                className="shrink-0 px-3 py-2 rounded-lg text-sm flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                                            >
                                                <Trash2 className="w-4 h-4" /> Xóa
                                            </button>
                                        )}
                                    </div>

                                    {/* Card info - compact on mobile */}
                                    <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex flex-wrap gap-3 md:flex-col md:gap-2">
                                            {selectedCard.dueDate && (
                                                <div className={`text-sm flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                    <Calendar className="w-4 h-4" />
                                                    {new Date(selectedCard.dueDate).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                            <div className={`text-sm flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                <Users className="w-4 h-4" />
                                                {selectedCard.assignees.length} người
                                            </div>
                                            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                Tạo bởi {selectedCard.creator.name}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* File Picker Dialog */}
                {showFilePicker && token && (
                    <FilePickerDialog
                        isOpen={showFilePicker}
                        onClose={() => setShowFilePicker(false)}
                        onSelect={(files) => {
                            handleAttachFromFolder(files);
                            setShowFilePicker(false);
                        }}
                        token={token}
                        multiple={true}
                    />
                )}

                {/* Google Drive Picker */}
                {showDrivePicker && (
                    <div
                        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowDrivePicker(false)}
                    >
                        <div
                            className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <GoogleDriveBrowser
                                onClose={() => setShowDrivePicker(false)}
                                mode="select"
                                onSelectFiles={(files) => {
                                    handleAttachFromDrive(files);
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* File Preview Modal */}
                {previewAttachment && previewIsOffice && kanbanOnlyOfficeId && (
                    <KanbanOnlyOfficeViewer
                        attachmentId={kanbanOnlyOfficeId}
                        fileName={previewAttachment.fileName}
                        onClose={() => { setPreviewAttachment(null); setPreviewUrl(''); setKanbanOnlyOfficeId(null); setPreviewIsOffice(false); }}
                    />
                )}
                {previewAttachment && previewUrl && !previewIsOffice && (
                    <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm flex flex-col" onClick={() => { setPreviewAttachment(null); setPreviewUrl(''); }}>
                        {/* Preview Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-black/40 shrink-0" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 min-w-0">
                                {getAttachmentIcon(previewAttachment.fileName, previewAttachment.mimeType)}
                                <span className="text-white text-sm font-medium truncate">{previewAttachment.fileName}</span>
                                <span className="text-gray-400 text-xs shrink-0">{formatFileSize(previewAttachment.fileSize)}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => handleDownloadAttachment(previewAttachment)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                                    title="Tải xuống"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => window.open(previewUrl, '_blank')}
                                    className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                                    title="Mở tab mới"
                                >
                                    <Eye className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => { setPreviewAttachment(null); setPreviewUrl(''); }}
                                    className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                                    title="Đóng"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        {/* Preview Content */}
                        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                            {previewAttachment.mimeType.startsWith('image/') ? (
                                <img
                                    src={previewUrl}
                                    alt={previewAttachment.fileName}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                />
                            ) : previewAttachment.mimeType.includes('pdf') ? (
                                <iframe
                                    src={previewUrl}
                                    className="w-full h-full rounded-lg bg-white"
                                    title={previewAttachment.fileName}
                                />
                            ) : previewAttachment.mimeType.startsWith('video/') ? (
                                <video
                                    src={previewUrl}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-full rounded-lg shadow-2xl"
                                />
                            ) : previewAttachment.mimeType.startsWith('audio/') ? (
                                <div className="bg-gray-900 p-8 rounded-xl">
                                    <p className="text-white text-center mb-4">{previewAttachment.fileName}</p>
                                    <audio src={previewUrl} controls autoPlay className="w-full" />
                                </div>
                            ) : (
                                <div className="text-center text-white">
                                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                                    <p className="text-lg font-medium mb-2">{previewAttachment.fileName}</p>
                                    <p className="text-gray-400 mb-4">Không thể xem trước loại file này</p>
                                    <button
                                        onClick={() => handleDownloadAttachment(previewAttachment)}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                    >
                                        Tải xuống
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ==================== MAIN RENDER ====================
    return (
        <div className={`h-full ${view === 'board' ? '-mx-4 -mb-4 sm:mx-0 sm:mb-0 -mt-4 sm:mt-0' : ''}`}>
            {view === 'boards' ? renderBoardsList() : renderBoardView()}
        </div>
    );
};

export default KanbanPage;
