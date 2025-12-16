import React, { useState, useEffect } from 'react';
import { Plus, Filter, Calendar, Briefcase, Pencil, Trash2, X, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { useDialog } from '../../components/ui/Dialog';
import ProjectImportExport from '../../components/ProjectImportExport';

interface UserData {
    id: number;
    name: string;
    role: string;
}

interface Project {
    id: number;
    code: string;
    name: string;
    manager?: { id: number, name: string };
    implementers?: { id: number, name: string }[];
    followers?: { id: number, name: string }[];
    startDate: string | null;
    endDate: string | null;
    duration: number;
    group: string;
    value: string;
    progressMethod: string;
    description: string;
    managerId: number;
    parentId?: number | null;
    children?: Project[];
}

interface UserMultiSelectProps {
    label: string;
    name: 'implementerIds' | 'followerIds';
    selectedIds: string[];
    users: UserData[];
    onSelectionChange: (name: 'implementerIds' | 'followerIds', userId: string) => void;
}

const UserMultiSelect = ({ label, name, selectedIds, users, onSelectionChange }: UserMultiSelectProps) => (
    <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="border border-gray-300 rounded-lg p-3 max-h-32 overflow-y-auto bg-white">
            {users.map(user => (
                <div key={user.id} className="flex items-center gap-2 py-1">
                    <input
                        type="checkbox"
                        id={`edit-${name}-${user.id}`}
                        checked={selectedIds.includes(String(user.id))}
                        onChange={() => onSelectionChange(name, String(user.id))}
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

const ProjectTasks = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const { token } = useAuth();
    const { showConfirm, showSuccess, showError } = useDialog();
    const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
    const [expandedChildDetails, setExpandedChildDetails] = useState<Set<number>>(new Set());

    // Import/Export Modal State
    const [showImportExport, setShowImportExport] = useState(false);

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
            const response = await fetch(`${API_URL}/projects`, {
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
            const response = await fetch(`${API_URL}/users`, {
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
        const confirmed = await showConfirm('Bạn có chắc chắn muốn xóa dự án này?');
        if (!confirmed) return;
        try {
            const response = await fetch(`${API_URL}/projects/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                fetchProjects();
            } else {
                showError('Xóa dự án thất bại');
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
            duration: String(project.duration || ''),
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
        setEditFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-calculate duration when dates change
            if ((name === 'startDate' || name === 'endDate') && newData.startDate && newData.endDate) {
                const start = new Date(newData.startDate);
                const end = new Date(newData.endDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                newData.duration = diffDays.toString();
            }

            return newData;
        });
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
            const response = await fetch(`${API_URL}/projects/${editingProject.id}`, {
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
                showSuccess('Cập nhật dự án thành công!');
            } else {
                showError('Cập nhật thất bại');
            }
        } catch (error) {
            console.error('Error updating project:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Quản lý dự án</h2>
                    <p className="text-gray-500 text-sm">Danh sách các dự án đang hoạt động</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowImportExport(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <FileSpreadsheet size={20} />
                        <span className="hidden sm:inline">Import/Export</span>
                    </button>
                    <Link to="/admin/create-project" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        <Plus size={20} />
                        <span>Thêm dự án mới</span>
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        <button title="Lọc dự án" className="p-2 hover:bg-gray-200 rounded-lg text-gray-600">
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
                        (() => {
                            const parentProjects = projects.filter(p => !p.parentId);

                            const toggleExpand = (projectId: number) => {
                                setExpandedProjects(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(projectId)) {
                                        newSet.delete(projectId);
                                    } else {
                                        newSet.add(projectId);
                                    }
                                    return newSet;
                                });
                            };

                            const toggleChildDetail = (projectId: number, e: React.MouseEvent) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setExpandedChildDetails(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(projectId)) {
                                        newSet.delete(projectId);
                                    } else {
                                        newSet.add(projectId);
                                    }
                                    return newSet;
                                });
                            };

                            const renderProject = (project: Project, depth = 0, isChild = false) => {
                                const hasChildren = project.children && project.children.length > 0;
                                const isExpanded = expandedProjects.has(project.id);
                                const isDetailExpanded = expandedChildDetails.has(project.id);
                                const indentClass = depth === 0 ? '' : depth === 1 ? 'pl-8' : depth === 2 ? 'pl-16' : 'pl-24';

                                return (
                                    <React.Fragment key={project.id}>
                                        {/* Project Row */}
                                        <div className={`p-3 md:p-4 hover:bg-gray-50 transition-colors ${indentClass}`}>
                                            <div className="flex items-start md:items-center justify-between gap-2 md:gap-4 group flex-wrap md:flex-nowrap">
                                                {/* Left side: Expand + Project Info */}
                                                <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                                                    {/* Expand/Collapse button for children */}
                                                    {hasChildren && (
                                                        <button
                                                            onClick={() => toggleExpand(project.id)}
                                                            className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                                                            title={isExpanded ? "Thu gọn" : "Mở rộng"}
                                                        >
                                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        </button>
                                                    )}
                                                    {!hasChildren && <div className="w-6 flex-shrink-0" />}

                                                    {/* Project link or clickable area for child projects */}
                                                    {isChild ? (
                                                        <button
                                                            onClick={(e) => toggleChildDetail(project.id, e)}
                                                            className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 text-left"
                                                        >
                                                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 flex-shrink-0">
                                                                <Briefcase size={20} className="md:w-6 md:h-6" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                                                    {project.name} <span className="text-gray-500 font-normal">({project.code})</span>
                                                                </h3>
                                                                <div className="flex items-center gap-2 md:gap-3 mt-1 flex-wrap">
                                                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                                                        <Calendar size={12} />
                                                                        <span className="hidden sm:inline">
                                                                            {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'} -
                                                                            {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                                        </span>
                                                                        <span className="sm:hidden">
                                                                            {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : 'N/A'}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ) : (
                                                        <Link to={`/admin/projects/${project.id}`} className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                                                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 flex-shrink-0">
                                                                <Briefcase size={20} className="md:w-6 md:h-6" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                                                    {project.name} <span className="text-gray-500 font-normal">({project.code})</span>
                                                                </h3>
                                                                <div className="flex items-center gap-2 md:gap-3 mt-1 flex-wrap">
                                                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                                                        <Calendar size={12} />
                                                                        <span className="hidden sm:inline">
                                                                            {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'} -
                                                                            {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                                        </span>
                                                                        <span className="sm:hidden">
                                                                            {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : 'N/A'}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    )}
                                                </div>

                                                {/* Right side: Manager + Actions */}
                                                <div className="flex items-center gap-2 md:gap-6 ml-auto">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-600 flex-shrink-0">
                                                            {project.manager?.name?.charAt(0) || '?'}
                                                        </div>
                                                        <span className="text-sm text-gray-600 hidden lg:block">{project.manager?.name || 'Chưa gán'}</span>
                                                    </div>

                                                    <div className="flex items-center gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <button title="Chỉnh sửa" onClick={() => openEditModal(project)} className="p-2 text-gray-400 hover:text-blue-600">
                                                            <Pencil size={16} className="md:w-[18px] md:h-[18px]" />
                                                        </button>
                                                        <button title="Xóa" onClick={() => handleDelete(project.id)} className="p-2 text-gray-400 hover:text-red-600">
                                                            <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Inline Detail View for Child Projects */}
                                        {isChild && isDetailExpanded && (
                                            <div className={`bg-blue-50 border-l-4 border-blue-400 ${indentClass}`}>
                                                <div className="p-4 space-y-4">
                                                    {/* Header */}
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="font-semibold text-gray-900 text-sm md:text-base">Chi tiết dự án con</h4>
                                                        <button
                                                            onClick={(e) => toggleChildDetail(project.id, e)}
                                                            className="text-gray-400 hover:text-gray-600"
                                                            title="Đóng"
                                                        >
                                                            <X size={20} />
                                                        </button>
                                                    </div>

                                                    {/* Project Details Grid - Responsive */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-sm">
                                                        <div>
                                                            <span className="text-gray-600 font-medium">Mã dự án:</span>
                                                            <p className="text-gray-900 mt-1">{project.code}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600 font-medium">Tên dự án:</span>
                                                            <p className="text-gray-900 mt-1">{project.name}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600 font-medium">Ngày bắt đầu:</span>
                                                            <p className="text-gray-900 mt-1">
                                                                {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'Chưa xác định'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600 font-medium">Ngày kết thúc:</span>
                                                            <p className="text-gray-900 mt-1">
                                                                {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'Chưa xác định'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600 font-medium">Thời hạn:</span>
                                                            <p className="text-gray-900 mt-1">{project.duration || 0} ngày</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600 font-medium">Nhóm dự án:</span>
                                                            <p className="text-gray-900 mt-1">{project.group || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600 font-medium">Giá trị:</span>
                                                            <p className="text-gray-900 mt-1">{project.value || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600 font-medium">Quản trị:</span>
                                                            <p className="text-gray-900 mt-1">{project.manager?.name || 'Chưa gán'}</p>
                                                        </div>
                                                    </div>

                                                    {/* Team Members */}
                                                    <div className="space-y-2">
                                                        <div>
                                                            <span className="text-gray-600 font-medium text-sm">Người thực hiện:</span>
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                {project.implementers && project.implementers.length > 0 ? (
                                                                    project.implementers.map(impl => (
                                                                        <span key={impl.id} className="px-2 py-1 bg-white rounded-full text-xs border border-gray-300">
                                                                            {impl.name}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-gray-500 text-xs">Chưa có</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600 font-medium text-sm">Người theo dõi:</span>
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                {project.followers && project.followers.length > 0 ? (
                                                                    project.followers.map(fol => (
                                                                        <span key={fol.id} className="px-2 py-1 bg-white rounded-full text-xs border border-gray-300">
                                                                            {fol.name}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-gray-500 text-xs">Chưa có</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Description */}
                                                    {project.description && (
                                                        <div>
                                                            <span className="text-gray-600 font-medium text-sm">Mô tả:</span>
                                                            <p className="text-gray-900 mt-1 text-sm leading-relaxed">{project.description}</p>
                                                        </div>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="flex gap-2 pt-2 border-t border-blue-200">
                                                        <Link
                                                            to={`/admin/projects/${project.id}`}
                                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
                                                        >
                                                            Xem chi tiết đầy đủ
                                                        </Link>
                                                        <button
                                                            onClick={() => openEditModal(project)}
                                                            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                                                        >
                                                            Chỉnh sửa
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Render children recursively */}
                                        {hasChildren && isExpanded && project.children!.map(child => renderProject(child, depth + 1, true))}
                                    </React.Fragment>
                                );
                            };

                            return parentProjects.map(project => renderProject(project));
                        })()
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Cập nhật dự án</h3>
                            <button title="Đóng" onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column - Basic Info */}
                            <div className="space-y-4">
                                <h4 className="font-semibold border-b pb-2">Thông tin chung</h4>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã dự án <span className="text-red-500">*</span></label>
                                    <input type="text" name="code" value={editFormData.code} onChange={handleEditChange} placeholder="VD: DA001" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên dự án <span className="text-red-500">*</span></label>
                                    <input type="text" name="name" value={editFormData.name} onChange={handleEditChange} placeholder="Nhập tên dự án" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                                        <input type="date" name="startDate" value={editFormData.startDate} onChange={handleEditChange} title="Ngày bắt đầu" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
                                        <input type="date" name="endDate" value={editFormData.endDate} onChange={handleEditChange} title="Ngày kết thúc" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Thời hạn (ngày)</label>
                                    <input type="number" name="duration" value={editFormData.duration} onChange={handleEditChange} placeholder="Số ngày thực hiện" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nhóm dự án</label>
                                    <input type="text" name="group" value={editFormData.group} onChange={handleEditChange} placeholder="Nhập nhóm dự án" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị hợp đồng</label>
                                    <input type="text" name="value" value={editFormData.value} onChange={handleEditChange} placeholder="Nhập giá trị hợp đồng" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                </div>
                            </div>

                            {/* Right Column - Details & Permissions */}
                            <div className="space-y-4">
                                <h4 className="font-semibold border-b pb-2">Chi tiết & Phân quyền</h4>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phương pháp tính tiến độ <span className="text-red-500">*</span></label>
                                    <select name="progressMethod" value={editFormData.progressMethod} onChange={handleEditChange} title="Phương pháp tính tiến độ" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                                        <option value="">-- Chọn phương pháp --</option>
                                        <option value="Theo bình quân % tiến độ các công việc thuộc dự án">Theo bình quân % tiến độ các công việc</option>
                                        <option value="Theo tỷ trọng ngày thực hiện">Theo tỷ trọng ngày thực hiện</option>
                                        <option value="Theo tỷ trọng công việc">Theo tỷ trọng công việc</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quản trị dự án <span className="text-red-500">*</span></label>
                                    <select name="managerId" value={editFormData.managerId} onChange={handleEditChange} title="Quản trị dự án" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                                        <option value="">-- Chọn quản trị --</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                                    </select>
                                </div>
                                <UserMultiSelect label="Người thực hiện" name="implementerIds" selectedIds={editFormData.implementerIds} users={users} onSelectionChange={handleMultiSelectChange} />
                                <UserMultiSelect label="Người theo dõi" name="followerIds" selectedIds={editFormData.followerIds} users={users} onSelectionChange={handleMultiSelectChange} />
                            </div>
                        </div>

                        {/* Description - Full Width */}
                        <div className="mt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả dự án</label>
                            <textarea
                                name="description"
                                value={editFormData.description}
                                onChange={handleEditChange}
                                rows={4}
                                placeholder="Nhập mô tả chi tiết về dự án..."
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
                            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Hủy</button>
                            <button onClick={handleUpdateProject} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Lưu thay đổi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import/Export Modal */}
            {showImportExport && (
                <ProjectImportExport
                    onClose={() => setShowImportExport(false)}
                    onSuccess={() => {
                        fetchProjects();
                        setShowImportExport(false);
                    }}
                />
            )}
        </div>
    );
};

export default ProjectTasks;
