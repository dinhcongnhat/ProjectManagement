import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, Clock, AlertCircle, Plus, Layout, Calendar, List, Pencil, Trash2, X, StickyNote, MessageSquare } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, DragOverlay, type DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { useDialog } from '../components/ui/Dialog';

interface Task {
    id: number;
    title: string;
    description: string | null;
    status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
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

const DroppableColumn = ({ id, children }: { id: string, children: React.ReactNode }) => {
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
        'COMPLETED': {
            bg: 'bg-emerald-50/80 dark:bg-emerald-900/20',
            border: 'border-emerald-200/50 dark:border-emerald-700/50'
        }
    };
    const config = columnConfig[id as keyof typeof columnConfig] || columnConfig['TODO'];

    return (
        <div ref={setNodeRef} className={`${config.bg} ${config.border} p-2.5 sm:p-3 rounded-xl flex flex-col border`}>
            {children}
        </div>
    );
};

const MyTasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [view, setView] = useState<'list' | 'kanban' | 'gantt'>('kanban'); // Default to kanban for mobile
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
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        reminderAt: '',
        type: 'PERSONAL'
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
        setFormData({ title: '', description: '', startDate: '', endDate: '', reminderAt: '', type: 'PERSONAL' });
        setEditingTask(null);
        setShowModal(false);
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
                type: formData.type
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
            type: task.type
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

        if (over && active.id !== over.id) {
            const taskId = Number(active.id);
            const newStatus = over.id as string;

            const task = filteredTasks.find(t => t.id === taskId);
            if (task && task.status !== newStatus) {
                updateStatus(taskId, newStatus);
            }
        }
    };

    const stats = {
        todo: filteredTasks.filter(t => t.status === 'TODO').length,
        inProgress: filteredTasks.filter(t => t.status === 'IN_PROGRESS').length,
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
                            onClick={() => setView('list')}
                            className={`p-1.5 rounded-md transition-all ${view === 'list'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            title="Danh sách"
                        >
                            <List size={16} />
                        </button>
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
            <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
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
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-green-500/30 w-fit">
                            <AlertCircle size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-2 sm:mt-0">{stats.completed}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Xong</p>
                </div>
            </div>

            {view === 'list' && (
                <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 overflow-hidden">
                    {tasks.length === 0 ? (
                        <div className="p-8 sm:p-12 text-center">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                <CheckSquare size={24} className="text-gray-400 sm:w-8 sm:h-8" />
                            </div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-1 sm:mb-2">Chưa có công việc</h3>
                            <p className="text-gray-500 text-sm">Hãy tạo công việc mới!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {tasks.map((task) => (
                                <div key={task.id} className="p-3 lg:p-4 hover:bg-gray-50 active:bg-gray-100 flex flex-col gap-2 group">
                                    <div className="flex items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={task.status === 'COMPLETED'}
                                                onChange={() => updateStatus(task.id, task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED')}
                                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0 mt-0.5 sm:mt-0 touch-target"
                                                title="Đánh dấu hoàn thành"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <h4 className={`font-medium text-gray-900 text-sm lg:text-base truncate ${task.status === 'COMPLETED' ? 'line-through text-gray-500' : ''}`}>{task.title}</h4>
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                                                    <span className={`px-1.5 py-0.5 rounded ${task.type === 'PERSONAL' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                        {task.type === 'PERSONAL' ? 'Cá nhân' : 'Được giao'}
                                                    </span>
                                                    {task.reminderAt && (
                                                        <span className="flex items-center gap-1 text-purple-600 font-medium bg-purple-50 px-1.5 py-0.5 rounded">
                                                            <Clock size={12} />
                                                            {formatDateTime(task.reminderAt)} {new Date(task.reminderAt) < new Date() && task.status !== 'COMPLETED' ? '(Quá hạn)' : ''}
                                                        </span>
                                                    )}
                                                    {task.note && (
                                                        <span className="flex items-center gap-1 text-amber-600">
                                                            <StickyNote size={12} />
                                                            Có ghi chú
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                                            <select
                                                value={task.status}
                                                onChange={(e) => updateStatus(task.id, e.target.value)}
                                                className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 border-none focus:ring-0 max-w-20 lg:max-w-none"
                                                title="Chọn trạng thái"
                                            >
                                                <option value="TODO">Todo</option>
                                                <option value="IN_PROGRESS">In Progress</option>
                                                <option value="COMPLETED">Completed</option>
                                            </select>
                                            <div className="flex gap-1">
                                                <NoteButton task={task} onOpenNote={openNoteModal} formatDateTime={formatDateTime} />
                                                {task.type === 'PERSONAL' && (
                                                    <>
                                                        <button onClick={() => openEditModal(task)} className="p-2 text-gray-400 hover:text-blue-600 active:text-blue-700 touch-target" title="Chỉnh sửa">
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-gray-400 hover:text-red-600 active:text-red-700 touch-target" title="Xóa">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {task.lastNoteAt && (
                                        <div className="text-xs text-gray-400 ml-8">
                                            Ghi chú lần cuối: {formatDateTime(task.lastNoteAt)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'kanban' && (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
                    {/* Vertical columns layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        {['TODO', 'IN_PROGRESS', 'COMPLETED'].map(status => (
                            <DroppableColumn key={status} id={status}>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                                        {status === 'TODO' ? '📋 Cần làm' : status === 'IN_PROGRESS' ? '🔄 Đang làm' : '✅ Hoàn thành'}
                                    </h3>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                        {filteredTasks.filter(t => t.status === status).length}
                                    </span>
                                </div>
                                <div className="space-y-2 max-h-64 sm:max-h-[400px] overflow-y-auto overscroll-contain">
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
                    <DragOverlay>
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

            {view === 'gantt' && (
                <div className="bg-white p-4 lg:p-6 rounded-xl border border-gray-200">
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <Calendar size={48} className="text-gray-300 mb-3" />
                        <h3 className="text-lg font-semibold text-gray-700">Chế độ Gantt không khả dụng</h3>
                        <p className="text-gray-500 max-w-sm mt-1">Chế độ xem Gantt hiện chỉ hỗ trợ cho các dự án có ngày bắt đầu và kết thúc cụ thể.</p>
                        <button onClick={() => setView('list')} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
                            Quay lại danh sách
                        </button>
                    </div>
                </div>
            )}

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

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 pb-safe">
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
                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 pb-safe">
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
