import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, AlertCircle, Plus, Layout, Calendar, List, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Task {
    id: number;
    title: string;
    description: string | null;
    status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
    type: 'ASSIGNED' | 'PERSONAL';
    startDate: string | null;
    endDate: string | null;
    project?: string; // Optional for now
}

const MyTasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [view, setView] = useState<'list' | 'kanban' | 'gantt'>('list');
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        type: 'PERSONAL'
    });

    const fetchTasks = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/tasks', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setTasks(data);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };

    useEffect(() => {
        if (token) fetchTasks();
    }, [token]);

    const resetForm = () => {
        setFormData({ title: '', description: '', startDate: '', endDate: '', type: 'PERSONAL' });
        setEditingTask(null);
        setShowModal(false);
    };

    const handleCreateOrUpdateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingTask
                ? `http://localhost:3000/api/tasks/${editingTask.id}`
                : 'http://localhost:3000/api/tasks';

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
            await fetch(`http://localhost:3000/api/tasks/${id}`, {
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
        try {
            await fetch(`http://localhost:3000/api/tasks/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status }),
            });
            fetchTasks();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const stats = {
        todo: tasks.filter(t => t.status === 'TODO').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
    };

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Công việc của tôi</h2>
                <div className="flex gap-2">
                    <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                        <button onClick={() => setView('list')} className={`p-2 rounded ${view === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}><List size={20} /></button>
                        <button onClick={() => setView('kanban')} className={`p-2 rounded ${view === 'kanban' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}><Layout size={20} /></button>
                        <button onClick={() => setView('gantt')} className={`p-2 rounded ${view === 'gantt' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}><Calendar size={20} /></button>
                    </div>
                    <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <Plus size={20} /> Tạo việc cá nhân
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckSquare className="text-blue-600" />
                        <h3 className="font-semibold text-blue-900">Cần làm</h3>
                    </div>
                    <p className="text-3xl font-bold text-blue-700">{stats.todo}</p>
                </div>
                <div className="bg-orange-50 p-6 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="text-orange-600" />
                        <h3 className="font-semibold text-orange-900">Đang thực hiện</h3>
                    </div>
                    <p className="text-3xl font-bold text-orange-700">{stats.inProgress}</p>
                </div>
                <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="text-green-600" />
                        <h3 className="font-semibold text-green-900">Hoàn thành</h3>
                    </div>
                    <p className="text-3xl font-bold text-green-700">{stats.completed}</p>
                </div>
            </div>

            {view === 'list' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    {tasks.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p>Chưa có công việc nào. Hãy tạo công việc mới!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {tasks.map((task) => (
                                <div key={task.id} className="p-4 hover:bg-gray-50 flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="checkbox"
                                            checked={task.status === 'COMPLETED'}
                                            onChange={() => updateStatus(task.id, task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED')}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <h4 className={`font-medium text-gray-900 ${task.status === 'COMPLETED' ? 'line-through text-gray-500' : ''}`}>{task.title}</h4>
                                            <p className="text-xs text-gray-500">{task.type === 'PERSONAL' ? 'Cá nhân' : 'Được giao'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <select
                                            value={task.status}
                                            onChange={(e) => updateStatus(task.id, e.target.value)}
                                            className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 border-none focus:ring-0"
                                        >
                                            <option value="TODO">Todo</option>
                                            <option value="IN_PROGRESS">In Progress</option>
                                            <option value="COMPLETED">Completed</option>
                                        </select>
                                        {task.type === 'PERSONAL' && (
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEditModal(task)} className="p-1 text-gray-400 hover:text-blue-600">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-600">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'kanban' && (
                <div className="grid grid-cols-3 gap-6 h-[500px]">
                    {['TODO', 'IN_PROGRESS', 'COMPLETED'].map(status => (
                        <div key={status} className="bg-gray-100 p-4 rounded-xl flex flex-col gap-3">
                            <h3 className="font-bold text-gray-700 mb-2">{status}</h3>
                            {tasks.filter(t => t.status === status).map(task => (
                                <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 group relative">
                                    <h4 className="font-medium text-gray-900 pr-6">{task.title}</h4>
                                    <p className="text-xs text-gray-500 mt-1">{task.type}</p>

                                    {task.type === 'PERSONAL' && (
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEditModal(task)} className="p-1 text-gray-400 hover:text-blue-600">
                                                <Pencil size={14} />
                                            </button>
                                            <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-600">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="mt-3 flex justify-end">
                                        <select
                                            value={task.status}
                                            onChange={(e) => updateStatus(task.id, e.target.value)}
                                            className="text-xs p-1 rounded border border-gray-300"
                                        >
                                            <option value="TODO">Todo</option>
                                            <option value="IN_PROGRESS">In Progress</option>
                                            <option value="COMPLETED">Completed</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
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
                                <div className="w-1/4 pr-4 truncate font-medium flex justify-between items-center">
                                    {task.title}
                                    {task.type === 'PERSONAL' && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEditModal(task)} className="p-1 text-gray-400 hover:text-blue-600">
                                                <Pencil size={14} />
                                            </button>
                                            <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-600">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900">{editingTask ? 'Edit Task' : 'Create Personal Task'}</h3>
                            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateOrUpdateTask} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                                >
                                    {editingTask ? 'Update Task' : 'Create Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTasks;
