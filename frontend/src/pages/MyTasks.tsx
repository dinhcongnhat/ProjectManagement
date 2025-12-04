import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Clock, AlertCircle, Plus, Layout, Calendar, List, Pencil, Trash2, X, StickyNote, MessageSquare } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

interface Task {
    id: number;
    title: string;
    description: string | null;
    status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
    type: 'ASSIGNED' | 'PERSONAL';
    startDate: string | null;
    endDate: string | null;
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
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className="relative">
            <button 
                onClick={(e) => { e.stopPropagation(); onOpenNote(task); }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onPointerDown={(e) => e.stopPropagation()}
                className={`p-1.5 rounded touch-target transition-colors ${task.note ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100'}`} 
                title="Ghi chú"
            >
                <MessageSquare size={14} />
            </button>
            
            {/* Tooltip popup khi hover */}
            {showTooltip && task.note && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 max-w-xs shadow-lg">
                        <div className="font-medium mb-1 text-amber-300">📝 Ghi chú:</div>
                        <p className="whitespace-pre-wrap break-words">{task.note.length > 150 ? task.note.substring(0, 150) + '...' : task.note}</p>
                        {task.lastNoteAt && (
                            <p className="text-gray-400 text-[10px] mt-1 border-t border-gray-700 pt-1">
                                Cập nhật: {formatDateTime(task.lastNoteAt)}
                            </p>
                        )}
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                            <div className="border-8 border-transparent border-t-gray-900"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DraggableTask = ({ task, children }: { task: Task, children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: task.id.toString(),
    });
    const style = {
        transform: CSS.Translate.toString(transform),
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {children}
        </div>
    );
};

const DroppableColumn = ({ id, children }: { id: string, children: React.ReactNode }) => {
    const { setNodeRef } = useDroppable({
        id: id,
    });

    return (
        <div ref={setNodeRef} className="bg-gray-100 p-4 rounded-xl flex flex-col gap-3 h-full min-h-[200px]">
            {children}
        </div>
    );
};

const MyTasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [view, setView] = useState<'list' | 'kanban' | 'gantt'>('list');
    const [showModal, setShowModal] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [selectedTaskForNote, setSelectedTaskForNote] = useState<Task | null>(null);
    const [noteContent, setNoteContent] = useState('');
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (token) fetchTasks();
    }, [token, fetchTasks]);

    const resetForm = () => {
        setFormData({ title: '', description: '', startDate: '', endDate: '', type: 'PERSONAL' });
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

    const handleCreateOrUpdateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingTask
                ? `${API_URL}/tasks/${editingTask.id}`
                : `${API_URL}/tasks`;

            const method = editingTask ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
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
        if (!confirm('Bạn có chắc chắn muốn xóa công việc này?')) return;
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
        setFormData({
            title: task.title,
            description: task.description || '',
            startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
            endDate: task.endDate ? new Date(task.endDate).toISOString().split('T')[0] : '',
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
            // fetchTasks(); // No need to re-fetch immediately if optimistic update is correct
        } catch (error) {
            console.error('Error updating status:', error);
            fetchTasks(); // Revert on error
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const taskId = Number(active.id);
            const newStatus = over.id as string;

            // Check if status actually changed (though over.id check handles most)
            const task = tasks.find(t => t.id === taskId);
            if (task && task.status !== newStatus) {
                updateStatus(taskId, newStatus);
            }
        }
    };

    const stats = {
        todo: tasks.filter(t => t.status === 'TODO').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
    };

    return (
        <div className="space-y-4 lg:space-y-6">
            {/* Header - Responsive */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Công việc của tôi</h2>
                <div className="flex gap-2">
                    {/* View Toggle - Smaller on mobile */}
                    <div className="flex bg-white rounded-lg border border-gray-200 p-0.5 lg:p-1">
                        <button onClick={() => setView('list')} className={`p-2 rounded touch-target ${view === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`} title="Xem dạng danh sách"><List size={18} className="lg:w-5 lg:h-5" /></button>
                        <button onClick={() => setView('kanban')} className={`p-2 rounded touch-target hidden sm:block ${view === 'kanban' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`} title="Xem dạng Kanban"><Layout size={18} className="lg:w-5 lg:h-5" /></button>
                        <button onClick={() => setView('gantt')} className={`p-2 rounded touch-target hidden sm:block ${view === 'gantt' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`} title="Xem dạng Gantt"><Calendar size={18} className="lg:w-5 lg:h-5" /></button>
                    </div>
                    <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm lg:text-base touch-target">
                        <Plus size={18} className="lg:w-5 lg:h-5" /> <span className="hidden sm:inline">Tạo việc cá nhân</span><span className="sm:hidden">Thêm</span>
                    </button>
                </div>
            </div>

            {/* Stats Grid - Responsive */}
            <div className="grid grid-cols-3 gap-2 lg:gap-6">
                <div className="bg-blue-50 p-3 lg:p-6 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 lg:gap-3 mb-1 lg:mb-2">
                        <CheckSquare className="text-blue-600 w-4 h-4 lg:w-5 lg:h-5" />
                        <h3 className="font-semibold text-blue-900 text-xs lg:text-base">Cần làm</h3>
                    </div>
                    <p className="text-xl lg:text-3xl font-bold text-blue-700">{stats.todo}</p>
                </div>
                <div className="bg-orange-50 p-3 lg:p-6 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-2 lg:gap-3 mb-1 lg:mb-2">
                        <Clock className="text-orange-600 w-4 h-4 lg:w-5 lg:h-5" />
                        <h3 className="font-semibold text-orange-900 text-xs lg:text-base">Đang làm</h3>
                    </div>
                    <p className="text-xl lg:text-3xl font-bold text-orange-700">{stats.inProgress}</p>
                </div>
                <div className="bg-green-50 p-3 lg:p-6 rounded-xl border border-green-100">
                    <div className="flex items-center gap-2 lg:gap-3 mb-1 lg:mb-2">
                        <AlertCircle className="text-green-600 w-4 h-4 lg:w-5 lg:h-5" />
                        <h3 className="font-semibold text-green-900 text-xs lg:text-base">Xong</h3>
                    </div>
                    <p className="text-xl lg:text-3xl font-bold text-green-700">{stats.completed}</p>
                </div>
            </div>

            {view === 'list' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    {tasks.length === 0 ? (
                        <div className="p-6 lg:p-8 text-center text-gray-500">
                            <p>Chưa có công việc nào. Hãy tạo công việc mới!</p>
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
                                                    <span>Tạo: {formatDateTime(task.createdAt)}</span>
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
                <DndContext onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-3 gap-6 h-[500px]">
                        {['TODO', 'IN_PROGRESS', 'COMPLETED'].map(status => (
                            <DroppableColumn key={status} id={status}>
                                <h3 className="font-bold text-gray-700 mb-2">{status === 'TODO' ? 'Cần làm' : status === 'IN_PROGRESS' ? 'Đang làm' : 'Hoàn thành'}</h3>
                                {tasks.filter(t => t.status === status).map(task => (
                                    <DraggableTask key={task.id} task={task}>
                                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 group relative cursor-move hover:shadow-md transition-shadow">
                                            <h4 className="font-medium text-gray-900 pr-16">{task.title}</h4>
                                            <p className="text-xs text-gray-500 mt-1">{task.type === 'PERSONAL' ? 'Cá nhân' : 'Được giao'}</p>

                                            {/* Note indicator */}
                                            {task.note && (
                                                <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                                                    <StickyNote size={12} />
                                                    <span className="truncate">Có ghi chú</span>
                                                </div>
                                            )}

                                            {/* Action buttons */}
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <NoteButton task={task} onOpenNote={openNoteModal} formatDateTime={formatDateTime} />
                                                {task.type === 'PERSONAL' && (
                                                    <>
                                                        <button onClick={(e) => { e.stopPropagation(); openEditModal(task); }} className="p-1 text-gray-400 hover:text-blue-600" onPointerDown={(e) => e.stopPropagation()} title="Chỉnh sửa">
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="p-1 text-gray-400 hover:text-red-600" onPointerDown={(e) => e.stopPropagation()} title="Xóa">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            <div className="mt-3 flex justify-between items-center">
                                                <span className="text-xs text-gray-400">{formatDateTime(task.createdAt).split(' ')[0]}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${task.status === 'TODO' ? 'bg-gray-100 text-gray-600' :
                                                    task.status === 'IN_PROGRESS' ? 'bg-orange-100 text-orange-600' :
                                                        'bg-green-100 text-green-600'
                                                    }`}>
                                                    {task.status === 'TODO' ? 'Todo' : task.status === 'IN_PROGRESS' ? 'Đang làm' : 'Xong'}
                                                </span>
                                            </div>
                                        </div>
                                    </DraggableTask>
                                ))}
                            </DroppableColumn>
                        ))}
                    </div>
                </DndContext>
            )}

            {view === 'gantt' && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 overflow-x-auto">
                    <h3 className="font-bold text-gray-900 mb-4">Timeline</h3>
                    <div className="min-w-[800px]">
                        {/* Simple Gantt implementation */}
                        <div className="flex border-b border-gray-200 pb-2 mb-4">
                            <div className="w-1/4 font-medium text-gray-500">Task</div>
                            <div className="w-3/4 flex justify-between text-gray-500 text-sm">
                                <span>Start</span>
                                <span>End</span>
                            </div>
                        </div>
                        {tasks.map(task => (
                            <div key={task.id} className="flex items-center py-2 border-b border-gray-50 group">
                                <div className="w-1/4 pr-4 truncate font-medium flex justify-between items-center gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="truncate">{task.title}</span>
                                        {task.note && (
                                            <StickyNote size={12} className="text-amber-500 shrink-0" />
                                        )}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <NoteButton task={task} onOpenNote={openNoteModal} formatDateTime={formatDateTime} />
                                        {task.type === 'PERSONAL' && (
                                            <>
                                                <button onClick={() => openEditModal(task)} className="p-1 text-gray-400 hover:text-blue-600" title="Chỉnh sửa">
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-600" title="Xóa">
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="w-3/4 relative h-8 bg-gray-50 rounded">
                                    {task.startDate && task.endDate && (
                                        <div
                                            className="absolute h-full bg-blue-500 rounded opacity-75 flex items-center px-2 text-white text-xs"
                                            style={{
                                                left: '0%', // Mock positioning
                                                width: '50%' // Mock width
                                            }}
                                        >
                                            {new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}
                                        </div>
                                    )}
                                    {(!task.startDate || !task.endDate) && <span className="text-xs text-gray-400 p-2">No dates set</span>}
                                </div>
                            </div>
                        ))}
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
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-3 lg:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        title="Ngày bắt đầu"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-3 lg:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        title="Ngày kết thúc"
                                    />
                                </div>
                            </div>
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
