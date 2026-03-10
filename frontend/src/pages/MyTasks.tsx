import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, Clock, AlertCircle, Plus, Layout, Calendar, Pencil, Trash2, X, StickyNote, MessageSquare, Eye } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, DragOverlay, type DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { API_URL } from '../config/api';
import { useDialog } from '../components/ui/Dialog';

interface Task {
    id: number;
    title: string;
    description: string | null;
    status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
    type: 'ASSIGNED' | 'PERSONAL';
    startDate: string | null;
    endDate: string | null;
    reminderAt: string | null;
    note: string | null;
    lastNoteAt: string | null;
    createdAt: string;
    updatedAt: string;
    project?: string; // Optional for now
}

// Note Tooltip Component
const NoteButton = ({ task, onOpenNote, formatDateTime }: {
    task: Task;
    onOpenNote: (task: Task) => void;
    formatDateTime: (date: string | null) => string;
}) => {
    const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleMouseEnter = () => {
        if (buttonRef.current && task.note) {
            const rect = buttonRef.current.getBoundingClientRect();
            setTooltipPos({
                x: rect.left + rect.width / 2,
                y: rect.top
            });
        }
    };

    return (
        <>
            <button
                ref={buttonRef}
                onClick={(e) => { e.stopPropagation(); onOpenNote(task); }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setTooltipPos(null)}
                onPointerDown={(e) => e.stopPropagation()}
                className={`p-1.5 rounded touch-target transition-colors ${task.note ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100'}`}
                title="Ghi chú"
            >
                <MessageSquare size={14} />
            </button>

            {tooltipPos && task.note && createPortal(
                <div
                    className="fixed z-[99999] pointer-events-none transform -translate-x-1/2 -translate-y-full pb-2 animate-in fade-in zoom-in-95 duration-200"
                    style={{ left: tooltipPos.x, top: tooltipPos.y }}
                >
                    <div className="bg-gray-900/95 backdrop-blur text-white text-xs rounded-lg py-2.5 px-3 max-w-xs shadow-2xl border border-gray-700/50">
                        <div className="font-bold mb-1.5 text-amber-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                            <StickyNote size={12} />
                            Ghi chú cá nhân
                        </div>
                        <p className="whitespace-pre-wrap break-words leading-relaxed text-gray-100 font-medium">
                            {task.note.length > 300 ? task.note.substring(0, 300) + '...' : task.note}
                        </p>
                        {task.lastNoteAt && (
                            <div className="text-gray-400 text-[10px] mt-2 border-t border-gray-700/50 pt-1.5 flex items-center gap-1.5">
                                <Clock size={10} />
                                <span>Cập nhật: {formatDateTime(task.lastNoteAt)}</span>
                            </div>
                        )}
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2">
                            <div className="border-[6px] border-transparent border-t-gray-900/95"></div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

const TaskCard = ({ task, onEdit, onDelete, onOpenNote, formatDateTime, formatDateTimeSimple }: any) => {
    if (!task) return null;

    return (
        <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 group relative cursor-grab">
            <h4 className="font-medium text-gray-900 dark:text-white text-sm pr-16 truncate">{task.title}</h4>
            <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[10px] px-1 py-0.5 rounded ${task.type === 'PERSONAL' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {task.type === 'PERSONAL' ? 'Cá nhân' : 'Giao'}
                </span>
                {task.reminderAt && (
                    <span className="text-[10px] text-purple-500 flex items-center gap-0.5">
                        <Clock size={8} />
                        {formatDateTimeSimple(task.reminderAt)}
                    </span>
                )}
            </div>
            {/* Action buttons */}
            <div className="absolute top-1 right-1 flex gap-0.5">
                <NoteButton task={task} onOpenNote={onOpenNote} formatDateTime={formatDateTime} />
                {task.type === 'PERSONAL' && (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1.5 text-gray-400 hover:text-blue-600 active:text-blue-700 rounded-lg" onPointerDown={(e) => e.stopPropagation()}>
                            <Pencil size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1.5 text-gray-400 hover:text-red-600 active:text-red-700 rounded-lg" onPointerDown={(e) => e.stopPropagation()}>
                            <Trash2 size={14} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const DraggableTask = ({ task, children }: { task: Task, children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id.toString(),
    });
    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative" {...listeners} {...attributes}>
            {children}
        </div>
    );
};

const DroppableColumn = ({ id, onAddTask, children }: { id: string, onAddTask?: (status: string) => void, children: React.ReactNode }) => {
    const { setNodeRef } = useDroppable({
        id: id,
    });

    const columnConfig = {
        'TODO': {
            bg: 'bg-blue-50/80 dark:bg-blue-900/20',
            border: 'border-blue-200/50 dark:border-blue-700/50'
        },
        'IN_PROGRESS': {
            bg: 'bg-amber-50/80 dark:bg-amber-900/20',
            border: 'border-amber-200/50 dark:border-amber-700/50'
        },
        'REVIEW': {
            bg: 'bg-purple-50/80 dark:bg-purple-900/20',
            border: 'border-purple-200/50 dark:border-purple-700/50'
        },
        'COMPLETED': {
            bg: 'bg-emerald-50/80 dark:bg-emerald-900/20',
            border: 'border-emerald-200/50 dark:border-emerald-700/50'
        }
    };
    const config = columnConfig[id as keyof typeof columnConfig] || columnConfig['TODO'];

    return (
        <div ref={setNodeRef} data-status-column={id} className={`${config.bg} ${config.border} p-2.5 sm:p-3 rounded-xl flex flex-col border transition-all`}>
            {children}
            {onAddTask && (
                <button
                    onClick={() => onAddTask(id)}
                    className="mt-2 flex items-center justify-center gap-1.5 p-2 w-full rounded-lg border border-dashed border-gray-400/50 dark:border-gray-500/50 text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-white/50 border-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 transition-all text-xs font-medium"
                >
                    <Plus size={14} /> Thêm công việc
                </button>
            )}
        </div>
    );
};

const MyTasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [view, setView] = useState<'kanban' | 'gantt'>('kanban');
    const [searchParams, setSearchParams] = useSearchParams();
    const statusParam = searchParams.get('status') as 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | null;
    const [mobileColumn, setMobileColumn] = useState<'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED'>(
        statusParam && ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].includes(statusParam) ? statusParam : 'TODO'
    );
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
    );
    const [showModal, setShowModal] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [selectedTaskForNote, setSelectedTaskForNote] = useState<Task | null>(null);
    const [noteContent, setNoteContent] = useState('');
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month'>('all'); // Time filter
    const { token } = useAuth();
    const { showConfirm } = useDialog();

    // Handle status URL parameter - scroll to/highlight the correct column
    useEffect(() => {
        if (statusParam && ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].includes(statusParam)) {
            setMobileColumn(statusParam);
            // Clear the status param from URL after applying
            setSearchParams(prev => {
                const newParams = new URLSearchParams(prev);
                newParams.delete('status');
                return newParams;
            }, { replace: true });

            // On desktop, scroll to the column
            if (!isMobile) {
                setTimeout(() => {
                    const columnIndex = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].indexOf(statusParam);
                    const columns = document.querySelectorAll('[data-status-column]');
                    if (columns[columnIndex]) {
                        columns[columnIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        // Briefly highlight the column
                        columns[columnIndex].classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
                        setTimeout(() => {
                            columns[columnIndex].classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
                        }, 2000);
                    }
                }, 500);
            }
        }
    }, [statusParam]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        reminderAt: '',
        type: 'PERSONAL',
        status: 'TODO'
    });

    const fetchTasks = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/tasks`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setTasks(data);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    }, [token]);

    useEffect(() => {
        if (token) fetchTasks();
    }, [token, fetchTasks]);

    // Filter tasks by time
    const getFilteredTasks = useCallback(() => {
        if (timeFilter === 'all') return tasks;

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        return tasks.filter(task => {
            const taskDate = task.reminderAt ? new Date(task.reminderAt) : new Date(task.createdAt);

            if (timeFilter === 'week') {
                return taskDate >= startOfWeek && taskDate <= endOfWeek;
            } else if (timeFilter === 'month') {
                return taskDate >= startOfMonth && taskDate <= endOfMonth;
            }
            return true;
        });
    }, [tasks, timeFilter]);

    const filteredTasks = getFilteredTasks();

    const resetForm = () => {
        setFormData({ title: '', description: '', startDate: '', endDate: '', reminderAt: '', type: 'PERSONAL', status: 'TODO' });
        setEditingTask(null);
        setShowModal(false);
    };

    const handleAddDirectTask = (status: string) => {
        resetForm();
        setFormData(prev => ({ ...prev, status }));
        setShowModal(true);
    };

    // Open note modal
    const openNoteModal = (task: Task) => {
        setSelectedTaskForNote(task);
        setNoteContent(task.note || '');
        setShowNoteModal(true);
    };

    // Close note modal
    const closeNoteModal = () => {
        setSelectedTaskForNote(null);
        setNoteContent('');
        setShowNoteModal(false);
    };

    // Save note
    const handleSaveNote = async () => {
        if (!selectedTaskForNote) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${selectedTaskForNote.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ note: noteContent }),
            });

            if (response.ok) {
                fetchTasks();
                closeNoteModal();
            }
        } catch (error) {
            console.error('Error saving note:', error);
        }
    };

    // Format date time
    const formatDateTime = (dateString: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDateTimeSimple = (dateString: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleCreateOrUpdateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingTask
                ? `${API_URL}/tasks/${editingTask.id}`
                : `${API_URL}/tasks`;

            const method = editingTask ? 'PUT' : 'POST';

            // Prepare payload
            const payload: any = {
                title: formData.title,
                description: formData.description,
                type: formData.type,
                status: formData.status
            };

            if (formData.type === 'PERSONAL') {
                if (formData.reminderAt) {
                    payload.reminderAt = new Date(formData.reminderAt).toISOString();
                } else {
                    payload.reminderAt = null;
                }
                payload.startDate = null;
                payload.endDate = null;
            } else {
                if (formData.startDate) payload.startDate = new Date(formData.startDate).toISOString();
                if (formData.endDate) payload.endDate = new Date(formData.endDate).toISOString();
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                resetForm();
                fetchTasks();
            }
        } catch (error) {
            console.error('Error saving task:', error);
        }
    };

    const handleDeleteTask = async (id: number) => {
        const confirmed = await showConfirm('Bạn có chắc chắn muốn xóa công việc này?');
        if (!confirmed) return;
        try {
            await fetch(`${API_URL}/tasks/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const openEditModal = (task: Task) => {
        setEditingTask(task);

        let reminderAtStr = '';
        if (task.reminderAt) {
            const date = new Date(task.reminderAt);
            const offset = date.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
            reminderAtStr = localISOTime;
        }

        setFormData({
            title: task.title,
            description: task.description || '',
            startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
            endDate: task.endDate ? new Date(task.endDate).toISOString().split('T')[0] : '',
            reminderAt: reminderAtStr,
            type: task.type,
            status: task.status
        });
        setShowModal(true);
    };

    const updateStatus = async (id: number, status: string) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: status as Task['status'] } : t));

        try {
            await fetch(`${API_URL}/tasks/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status }),
            });
        } catch (error) {
            console.error('Error updating status:', error);
            fetchTasks(); // Revert on error
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const taskId = Number(active.id);
            const newStatus = over.id as string;

            const task = filteredTasks.find(t => t.id === taskId);
            if (task && task.status !== newStatus) {
                updateStatus(taskId, newStatus);
            }
        }
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const stats = {
        todo: filteredTasks.filter(t => t.status === 'TODO').length,
        inProgress: filteredTasks.filter(t => t.status === 'IN_PROGRESS').length,
        review: filteredTasks.filter(t => t.status === 'REVIEW').length,
        completed: filteredTasks.filter(t => t.status === 'COMPLETED').length,
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Công việc của tôi</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 text-sm sm:text-base">Quản lý và theo dõi các nhiệm vụ</p>
                </div>

                {/* Controls - Right side */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Time Filter - Compact */}
                    <select
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value as 'all' | 'week' | 'month')}
                        className="text-xs px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="all">Tất cả</option>
                        <option value="week">Tuần này</option>
                        <option value="month">Tháng này</option>
                    </select>

                    {/* View Toggle */}
                    <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
                        <button
                            onClick={() => setView('kanban')}
                            className={`p-1.5 rounded-md transition-all ${view === 'kanban'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            title="Kanban"
                        >
                            <Layout size={16} />
                        </button>
                        <button
                            onClick={() => setView('gantt')}
                            className={`p-1.5 rounded-md transition-all ${view === 'gantt'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            title="Gantt"
                        >
                            <Calendar size={16} />
                        </button>
                    </div>

                    {/* Add Button */}
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-all active:scale-95"
                    >
                        <Plus size={14} />
                        <span>Thêm</span>
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-none group">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-blue-500/30 w-fit">
                            <CheckSquare size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-2 sm:mt-0">{stats.todo}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Cần làm</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-none group">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-orange-500/30 w-fit">
                            <Clock size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-2 sm:mt-0">{stats.inProgress}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Đang làm</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-none group">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-purple-500/30 w-fit">
                            <Eye size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-2 sm:mt-0">{stats.review}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Cần review</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-none group">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-green-500/30 w-fit">
                            <AlertCircle size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-2 sm:mt-0">{stats.completed}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Xong</p>
                </div>
            </div>

            {view === 'kanban' && (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart} onDragCancel={handleDragCancel}>
                    {/* Mobile: tab selector for columns */}
                    <div className="sm:hidden flex bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 mb-3 gap-1">
                        {(['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'] as const).map(status => {
                            const labels = { TODO: '📋 Cần làm', IN_PROGRESS: '🔄 Đang làm', REVIEW: '👁 Review', COMPLETED: '✅ Xong' };
                            const count = filteredTasks.filter(t => t.status === status).length;
                            return (
                                <button
                                    key={status}
                                    onClick={() => setMobileColumn(status)}
                                    className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all ${mobileColumn === status
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {labels[status]} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* Desktop: 4 columns grid */}
                    {!isMobile && (
                        <div className="grid sm:grid-cols-4 gap-3 sm:gap-4">
                            {(['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'] as const).map(status => (
                                <DroppableColumn key={status} id={status} onAddTask={handleAddDirectTask}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                                            {status === 'TODO' ? '📋 Cần làm' : status === 'IN_PROGRESS' ? '🔄 Đang làm' : status === 'REVIEW' ? '👁 Cần review' : '✅ Hoàn thành'}
                                        </h3>
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                            {filteredTasks.filter(t => t.status === status).length}
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto overscroll-contain">
                                        {filteredTasks.filter(t => t.status === status).length === 0 ? (
                                            <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-xs">
                                                Không có công việc
                                            </div>
                                        ) : (
                                            filteredTasks.filter(t => t.status === status).map(task => (
                                                <DraggableTask key={task.id} task={task}>
                                                    <TaskCard
                                                        task={task}
                                                        onEdit={openEditModal}
                                                        onDelete={handleDeleteTask}
                                                        onOpenNote={openNoteModal}
                                                        formatDateTime={formatDateTime}
                                                        formatDateTimeSimple={formatDateTimeSimple}
                                                    />
                                                </DraggableTask>
                                            ))
                                        )}
                                    </div>
                                </DroppableColumn>
                            ))}
                        </div>
                    )}

                    {/* Mobile: single column view */}
                    {isMobile && (
                        <div>
                            <DroppableColumn id={mobileColumn} onAddTask={handleAddDirectTask}>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                                        {mobileColumn === 'TODO' ? '📋 Cần làm' : mobileColumn === 'IN_PROGRESS' ? '🔄 Đang làm' : mobileColumn === 'REVIEW' ? '👁 Cần review' : '✅ Hoàn thành'}
                                    </h3>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                        {filteredTasks.filter(t => t.status === mobileColumn).length}
                                    </span>
                                </div>
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto overscroll-contain">
                                    {filteredTasks.filter(t => t.status === mobileColumn).length === 0 ? (
                                        <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-xs">
                                            Không có công việc
                                        </div>
                                    ) : (
                                        filteredTasks.filter(t => t.status === mobileColumn).map(task => (
                                            <DraggableTask key={task.id} task={task}>
                                                <TaskCard
                                                    task={task}
                                                    onEdit={openEditModal}
                                                    onDelete={handleDeleteTask}
                                                    onOpenNote={openNoteModal}
                                                    formatDateTime={formatDateTime}
                                                    formatDateTimeSimple={formatDateTimeSimple}
                                                />
                                            </DraggableTask>
                                        ))
                                    )}
                                </div>
                            </DroppableColumn>
                        </div>
                    )}
                    <DragOverlay dropAnimation={null} zIndex={9999}>
                        {activeId ? (
                            <TaskCard
                                task={filteredTasks.find(t => t.id.toString() === activeId)}
                                onEdit={openEditModal}
                                onDelete={handleDeleteTask}
                                onOpenNote={openNoteModal}
                                formatDateTime={formatDateTime}
                                formatDateTimeSimple={formatDateTimeSimple}
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}

            {view === 'gantt' && (() => {
                // Calculate timeline range
                const tasksWithDates = filteredTasks.filter(t => t.reminderAt || t.startDate || t.endDate);

                if (tasksWithDates.length === 0) {
                    return (
                        <div className="bg-white dark:bg-gray-800 p-4 lg:p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                            <div className="flex flex-col items-center justify-center p-8 text-center">
                                <Calendar size={48} className="text-gray-300 mb-3" />
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Chưa có công việc</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-sm mt-1">Hãy tạo công việc mới để xem biểu đồ Gantt.</p>
                            </div>
                        </div>
                    );
                }

                // Determine timeline boundaries
                const now = new Date();
                let minDate = new Date(now);
                let maxDate = new Date(now);

                tasksWithDates.forEach(t => {
                    const dates = [
                        t.startDate ? new Date(t.startDate) : null,
                        t.endDate ? new Date(t.endDate) : null,
                        t.reminderAt ? new Date(t.reminderAt) : null,
                        new Date(t.createdAt),
                    ].filter(Boolean) as Date[];
                    dates.forEach(d => {
                        if (d < minDate) minDate = new Date(d);
                        if (d > maxDate) maxDate = new Date(d);
                    });
                });

                // Add padding: 2 days before and 5 days after
                minDate.setDate(minDate.getDate() - 2);
                maxDate.setDate(maxDate.getDate() + 5);

                // Ensure minimum 7-day range
                const diffDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 7) {
                    maxDate.setDate(minDate.getDate() + 7);
                }

                const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
                const dayWidth = Math.max(40, Math.min(80, 800 / totalDays)); // Responsive day width

                // Generate day columns
                const days: Date[] = [];
                for (let i = 0; i <= totalDays; i++) {
                    const d = new Date(minDate);
                    d.setDate(d.getDate() + i);
                    days.push(d);
                }

                const getPositionPercent = (date: Date) => {
                    return ((date.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100;
                };

                const statusColors: Record<string, { bg: string; border: string; text: string }> = {
                    'TODO': { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white' },
                    'IN_PROGRESS': { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white' },
                    'REVIEW': { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-white' },
                    'COMPLETED': { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white' },
                };

                const isToday = (d: Date) => {
                    const today = new Date();
                    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                };

                const isSunday = (d: Date) => d.getDay() === 0;
                const isSaturday = (d: Date) => d.getDay() === 6;

                return (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
                        {/* Legend */}
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-4 text-xs">
                            <span className="font-semibold text-gray-700 dark:text-gray-200">Chú thích:</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500"></span> Cần làm</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500"></span> Đang làm</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500"></span> Cần review</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500"></span> Hoàn thành</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 ring-2 ring-purple-200"></span> Nhắc nhở</span>
                        </div>

                        <div className="overflow-x-auto">
                            <div style={{ minWidth: `${Math.max(days.length * dayWidth + 200, 600)}px` }}>
                                {/* Timeline header */}
                                <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                                    {/* Task name column */}
                                    <div className="w-[200px] min-w-[200px] px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                                        Công việc
                                    </div>
                                    {/* Days */}
                                    <div className="flex flex-1">
                                        {days.map((d, i) => (
                                            <div
                                                key={i}
                                                style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px` }}
                                                className={`text-center py-1.5 text-[10px] border-r border-gray-100 dark:border-gray-700/50 ${isToday(d) ? 'bg-blue-50 dark:bg-blue-900/30 font-bold text-blue-700 dark:text-blue-300' :
                                                    isSunday(d) ? 'bg-red-50/50 dark:bg-red-900/10 text-red-400' :
                                                        isSaturday(d) ? 'bg-orange-50/50 dark:bg-orange-900/10 text-orange-400' :
                                                            'text-gray-500 dark:text-gray-400'
                                                    }`}
                                            >
                                                <div className="font-medium">{d.getDate()}/{d.getMonth() + 1}</div>
                                                <div className="text-[9px] opacity-70">{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Task rows */}
                                {tasksWithDates.map((task) => {
                                    const color = statusColors[task.status] || statusColors['TODO'];
                                    const hasRange = task.startDate && task.endDate;
                                    const taskStart = task.startDate ? new Date(task.startDate) : task.reminderAt ? new Date(task.reminderAt) : new Date(task.createdAt);
                                    const taskEnd = task.endDate ? new Date(task.endDate) : task.startDate ? new Date(task.startDate) : task.reminderAt ? new Date(task.reminderAt) : new Date(task.createdAt);

                                    // Ensure end >= start
                                    const barStart = taskStart < taskEnd ? taskStart : taskEnd;
                                    const barEnd = taskStart < taskEnd ? taskEnd : taskStart;

                                    const startPercent = getPositionPercent(barStart);
                                    const endPercent = getPositionPercent(barEnd);
                                    const widthPercent = Math.max(endPercent - startPercent, 1.5); // Minimum width for visibility

                                    const reminderDate = task.reminderAt ? new Date(task.reminderAt) : null;
                                    const reminderPercent = reminderDate ? getPositionPercent(reminderDate) : null;

                                    return (
                                        <div key={task.id} className="flex border-b border-gray-50 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 group">
                                            {/* Task name */}
                                            <div className="w-[200px] min-w-[200px] px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.bg}`}></span>
                                                <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={task.title}>
                                                    {task.title}
                                                </span>
                                                {task.status === 'COMPLETED' && <span className="text-[9px] text-emerald-500">✓</span>}
                                            </div>
                                            {/* Gantt bar area */}
                                            <div className="flex-1 relative py-1.5" style={{ minHeight: '36px' }}>
                                                {/* Background grid lines */}
                                                <div className="absolute inset-0 flex">
                                                    {days.map((d, i) => (
                                                        <div
                                                            key={i}
                                                            style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px` }}
                                                            className={`border-r border-gray-50 dark:border-gray-700/20 ${isToday(d) ? 'bg-blue-50/40 dark:bg-blue-900/10' :
                                                                isSunday(d) || isSaturday(d) ? 'bg-gray-50/40 dark:bg-gray-700/10' : ''
                                                                }`}
                                                        />
                                                    ))}
                                                </div>
                                                {/* Today line */}
                                                {(() => {
                                                    const todayPercent = getPositionPercent(now);
                                                    if (todayPercent >= 0 && todayPercent <= 100) {
                                                        return <div className="absolute top-0 bottom-0 w-px bg-red-400 dark:bg-red-500 z-10 opacity-60" style={{ left: `${todayPercent}%` }} />;
                                                    }
                                                    return null;
                                                })()}
                                                {/* Task bar */}
                                                <div
                                                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-md ${color.bg} opacity-85 group-hover:opacity-100 transition-opacity shadow-sm cursor-default z-[2]`}
                                                    style={{
                                                        left: `${startPercent}%`,
                                                        width: `${widthPercent}%`,
                                                        minWidth: hasRange ? '8px' : '16px',
                                                    }}
                                                    title={`${task.title}\n${hasRange ? `${new Date(task.startDate!).toLocaleDateString('vi-VN')} → ${new Date(task.endDate!).toLocaleDateString('vi-VN')}` : task.reminderAt ? `Nhắc: ${new Date(task.reminderAt).toLocaleString('vi-VN')}` : `Tạo: ${new Date(task.createdAt).toLocaleDateString('vi-VN')}`}`}
                                                >
                                                    {widthPercent > 8 && (
                                                        <span className={`absolute inset-0 flex items-center px-1.5 text-[9px] ${color.text} font-medium truncate`}>
                                                            {task.title}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Reminder marker */}
                                                {reminderPercent !== null && reminderPercent >= 0 && reminderPercent <= 100 && (
                                                    <div
                                                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-200 dark:ring-purple-800 z-[3]"
                                                        style={{ left: `${reminderPercent}%`, marginLeft: '-5px' }}
                                                        title={`Nhắc nhở: ${new Date(task.reminderAt!).toLocaleString('vi-VN')}`}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto slide-up sm:fade-in">
                        <div className="flex justify-between items-center p-4 lg:p-6 border-b border-gray-100 sticky top-0 bg-white">
                            <h3 className="text-lg lg:text-xl font-bold text-gray-900">{editingTask ? 'Chỉnh sửa công việc' : 'Tạo việc cá nhân'}</h3>
                            <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-600 active:text-gray-700 touch-target" title="Đóng">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateOrUpdateTask} className="p-4 lg:p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-3 lg:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Nhập tiêu đề"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                                <textarea
                                    className="w-full px-3 py-3 lg:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-24"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Nhập mô tả"
                                />
                            </div>

                            {formData.type === 'PERSONAL' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className="p-1 bg-amber-100 text-amber-600 rounded">
                                                <Clock size={14} />
                                            </div>
                                            Hẹn giờ nhắc nhở
                                        </div>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-3 py-3 lg:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                        value={formData.reminderAt}
                                        onChange={(e) => setFormData({ ...formData, reminderAt: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-500 mt-1.5">
                                        Hệ thống sẽ gửi thông báo và email khi đến giờ hẹn.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-3 lg:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                            disabled={true} // Assigned tasks usually manage dates in Project
                                            title="Ngày bắt đầu (Chỉ xem)"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-3 lg:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                            disabled={true} // Assigned tasks usually manage dates in Project
                                            title="Ngày kết thúc (Chỉ xem)"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="w-full sm:w-auto px-4 py-3 lg:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 rounded-lg border border-gray-200 touch-target"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto px-4 py-3 lg:py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg touch-target"
                                >
                                    {editingTask ? 'Cập nhật' : 'Tạo mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Note Modal */}
            {showNoteModal && selectedTaskForNote && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto slide-up sm:fade-in">
                        <div className="flex justify-between items-center p-4 lg:p-6 border-b border-gray-100 sticky top-0 bg-white">
                            <div>
                                <h3 className="text-lg lg:text-xl font-bold text-gray-900">Ghi chú</h3>
                                <p className="text-sm text-gray-500 truncate">{selectedTaskForNote.title}</p>
                            </div>
                            <button onClick={closeNoteModal} className="p-2 text-gray-400 hover:text-gray-600 active:text-gray-700 touch-target" title="Đóng">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 lg:p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Nội dung ghi chú</label>
                                <textarea
                                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-32"
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    placeholder="Nhập ghi chú của bạn..."
                                    style={{ fontSize: '16px' }}
                                />
                            </div>
                            {selectedTaskForNote.lastNoteAt && (
                                <p className="text-xs text-gray-500">
                                    Ghi chú lần cuối: {formatDateTime(selectedTaskForNote.lastNoteAt)}
                                </p>
                            )}
                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeNoteModal}
                                    className="w-full sm:w-auto px-4 py-3 lg:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 rounded-lg border border-gray-200 touch-target"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSaveNote}
                                    className="w-full sm:w-auto px-4 py-3 lg:py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 rounded-lg touch-target"
                                >
                                    Lưu ghi chú
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTasks;
