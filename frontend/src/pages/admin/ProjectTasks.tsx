import { useState, useEffect } from 'react';
import { Plus, Filter, Calendar, Briefcase, Pencil, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface UserData {
    id: number;
    name: string;
    role: string;
}

interface Project {
    id: number;
    code: string;
    name: string;
    manager: { id: number, name: string };
    implementers: { id: number, name: string }[];
    followers: { id: number, name: string }[];
    startDate: string;
    endDate: string;
    duration: string;
    group: string;
    value: string;
    progressMethod: string;
    description: string;
}

const ProjectTasks = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const { token } = useAuth();

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [editFormData, setEditFormData] = useState({
        code: '',
        name: '',
        startDate: '',
        endDate: '',
        duration: '',
        group: '',
        value: '',
        progressMethod: '',
        managerId: '',
        implementerIds: [] as string[],
        followerIds: [] as string[],
        description: ''
    });

    const fetchProjects = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/projects', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setProjects(data);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/users', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (Array.isArray(data)) setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    useEffect(() => {
        if (token) {
            fetchProjects();
            fetchUsers();
        }
    }, [token]);

    const handleDelete = async (id: number) => {
        if (!confirm('Bạn có chắc chắn muốn xóa dự án này?')) return;
        try {
            const response = await fetch(`http://localhost:3000/api/projects/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                fetchProjects();
            } else {
                alert('Xóa dự án thất bại');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    const openEditModal = (project: Project) => {
        setEditingProject(project);
        setEditFormData({
            code: project.code,
            name: project.name,
            startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
            endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
            duration: project.duration || '',
            group: project.group || '',
            value: project.value || '',
            progressMethod: project.progressMethod,
            managerId: String(project.manager?.id || ''),
            implementerIds: project.implementers?.map(u => String(u.id)) || [],
            followerIds: project.followers?.map(u => String(u.id)) || [],
            description: project.description || ''
        });
        setShowEditModal(true);
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMultiSelectChange = (name: 'implementerIds' | 'followerIds', userId: string) => {
        setEditFormData(prev => {
            const currentIds = prev[name];
            if (currentIds.includes(userId)) {
                return { ...prev, [name]: currentIds.filter(id => id !== userId) };
            } else {
                return { ...prev, [name]: [...currentIds, userId] };
            }
        });
    };

    const handleUpdateProject = async () => {
        if (!editingProject) return;
        try {
            const response = await fetch(`http://localhost:3000/api/projects/${editingProject.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(editFormData),
            });

            if (response.ok) {
                setShowEditModal(false);
                fetchProjects();
                alert('Cập nhật dự án thành công!');
            } else {
                alert('Cập nhật thất bại');
            }
        } catch (error) {
            console.error('Error updating project:', error);
        }
    };

    const UserMultiSelect = ({ label, name, selectedIds }: { label: string, name: 'implementerIds' | 'followerIds', selectedIds: string[] }) => (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <div className="border border-gray-300 rounded-lg p-3 max-h-32 overflow-y-auto bg-white">
                {users.map(user => (
                    <div key={user.id} className="flex items-center gap-2 py-1">
                        <input
                            type="checkbox"
                            id={`edit-${name}-${user.id}`}
                            checked={selectedIds.includes(String(user.id))}
                            onChange={() => handleMultiSelectChange(name, String(user.id))}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor={`edit-${name}-${user.id}`} className="text-sm text-gray-700 cursor-pointer select-none">
                            {user.name}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Quản lý dự án</h2>
                    <p className="text-gray-500 text-sm">Danh sách các dự án đang hoạt động</p>
                </div>
                <Link to="/admin/create-project" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={20} />
                    <span>Thêm dự án mới</span>
                </Link>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-200 rounded-lg text-gray-600">
                            <Filter size={20} />
                        </button>
                        <div className="h-6 w-px bg-gray-300 mx-2"></div>
                        <span className="text-sm font-medium text-gray-700">{projects.length} dự án</span>
                    </div>
                </div>

                <div className="divide-y divide-gray-100">
                    {projects.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            Chưa có dự án nào. Hãy tạo dự án mới.
                        </div>
                    ) : (
                        projects.map((project) => (
                            <div key={project.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                        <Briefcase size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {project.name} <span className="text-gray-500 font-normal">({project.code})</span>
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                <Calendar size={12} />
                                                {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'} -
                                                {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-600">
                                            {project.manager?.name?.charAt(0) || '?'}
                                        </div>
                                        <span className="text-sm text-gray-600 hidden md:block">{project.manager?.name || 'Chưa gán'}</span>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(project)} className="p-2 text-gray-400 hover:text-blue-600">
                                            <Pencil size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(project.id)} className="p-2 text-gray-400 hover:text-red-600">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Cập nhật dự án</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h4 className="font-semibold border-b pb-2">Thông tin chung</h4>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã dự án</label>
                                    <input type="text" name="code" value={editFormData.code} onChange={handleEditChange} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên dự án</label>
                                    <input type="text" name="name" value={editFormData.name} onChange={handleEditChange} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                                        <input type="date" name="startDate" value={editFormData.startDate} onChange={handleEditChange} className="w-full px-3 py-2 border rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
                                        <input type="date" name="endDate" value={editFormData.endDate} onChange={handleEditChange} className="w-full px-3 py-2 border rounded-lg" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-semibold border-b pb-2">Phân quyền</h4>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quản trị dự án</label>
                                    <select name="managerId" value={editFormData.managerId} onChange={handleEditChange} className="w-full px-3 py-2 border rounded-lg">
                                        <option value="">-- Chọn quản trị --</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <UserMultiSelect label="Người thực hiện" name="implementerIds" selectedIds={editFormData.implementerIds} />
                                <UserMultiSelect label="Người theo dõi" name="followerIds" selectedIds={editFormData.followerIds} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
                            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Hủy</button>
                            <button onClick={handleUpdateProject} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Lưu thay đổi</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectTasks;
