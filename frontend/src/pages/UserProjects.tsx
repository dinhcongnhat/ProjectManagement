import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Calendar, User, CheckCircle2, Clock, AlertCircle, FolderTree, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

interface SubProject {
    id: number;
    code: string;
    name: string;
    progress: number;
    status: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED';
    startDate: string;
    endDate: string;
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
    progress: number;
    status: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED';
    parentId?: number;
    parent?: { id: number, name: string, code: string };
    children?: SubProject[];
}

const UserProjects = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const { token, user } = useAuth();
    const [updatingProgress, setUpdatingProgress] = useState<number | null>(null);
    const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

    const toggleExpanded = (projectId: number) => {
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

    const fetchProjects = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/projects`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (Array.isArray(data)) {
                // Filter projects where user is involved and only show root projects (no parentId)
                const myProjects = data.filter((project: Project) =>
                    !project.parentId && (
                        project.manager?.id === user?.id ||
                        project.implementers?.some((imp: { id: number }) => imp.id === user?.id) ||
                        project.followers?.some((fol: { id: number }) => fol.id === user?.id)
                    )
                );
                setProjects(myProjects);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    }, [token, user]);

    useEffect(() => {
        if (token && user) fetchProjects();
    }, [token, user, fetchProjects]);

    const handleProgressChange = async (projectId: number, newProgress: number) => {
        setUpdatingProgress(projectId);
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}/progress`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ progress: newProgress }),
            });

            if (response.ok) {
                const updatedProject = await response.json();
                setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
            } else {
                alert('Không thể cập nhật tiến độ');
            }
        } catch (error) {
            console.error('Error updating progress:', error);
            alert('Có lỗi xảy ra khi cập nhật tiến độ');
        } finally {
            setUpdatingProgress(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        <CheckCircle2 size={14} />
                        Hoàn thành
                    </span>
                );
            case 'PENDING_APPROVAL':
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                        <Clock size={14} />
                        Chờ duyệt
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        <AlertCircle size={14} />
                        Đang thực hiện
                    </span>
                );
        }
    };

    return (
        <div className="space-y-4 lg:space-y-6">
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Dự án của tôi</h2>

            <div className="grid grid-cols-1 gap-4 lg:gap-6">
                {projects.length === 0 ? (
                    <div className="col-span-full text-center py-8 lg:py-12 bg-white rounded-xl border border-gray-200 text-gray-500 text-sm lg:text-base">
                        Chưa có dự án nào được giao cho bạn.
                    </div>
                ) : (
                    projects.map((project) => (
                        <div key={project.id} className="bg-white p-4 lg:p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md active:shadow-sm transition-shadow">
                            <div className="flex flex-col gap-4 lg:gap-6">
                                {/* Project Info */}
                                <div className="flex-1">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 lg:p-3 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                                                <Briefcase size={20} className="lg:w-6 lg:h-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <Link to={`/projects/${project.id}`} className="text-base lg:text-lg font-bold text-gray-900 hover:text-blue-600 active:text-blue-700 transition-colors line-clamp-2">
                                                    {project.name}
                                                </Link>
                                                <p className="text-xs lg:text-sm text-gray-500 mt-1">Mã: {project.code}</p>
                                            </div>
                                        </div>
                                        <div className="self-start sm:shrink-0">
                                            {getStatusBadge(project.status)}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3 mt-3 lg:mt-4">
                                        <div className="flex items-center gap-2 text-xs lg:text-sm text-gray-600">
                                            <User size={14} className="text-gray-400 shrink-0 lg:w-4 lg:h-4" />
                                            <span className="truncate">PM: {project.manager?.name || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs lg:text-sm text-gray-600">
                                            <Calendar size={14} className="text-gray-400 shrink-0 lg:w-4 lg:h-4" />
                                            <span className="truncate">
                                                {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'} -
                                                {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Control */}
                                <div className="border-t lg:border-t-0 lg:border-l border-gray-200 pt-4 lg:pt-0 lg:pl-6 lg:w-80">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-700">Tiến độ</span>
                                            <span className="text-2xl font-bold text-blue-600">{project.progress}%</span>
                                        </div>

                                        {/* Progress Slider */}
                                        <div className="relative">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={project.progress}
                                                onChange={(e) => handleProgressChange(project.id, Number(e.target.value))}
                                                disabled={project.status === 'COMPLETED' || project.status === 'PENDING_APPROVAL' || updatingProgress === project.id}
                                                className={`w-full h-3 rounded-lg appearance-none cursor-pointer progress-slider ${project.status === 'COMPLETED' ? 'bg-green-200' :
                                                    project.status === 'PENDING_APPROVAL' ? 'bg-orange-200' :
                                                        'bg-blue-200'
                                                    } ${project.status === 'COMPLETED' || project.status === 'PENDING_APPROVAL' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                title={`Tiến độ: ${project.progress}%`}
                                            />
                                        </div>

                                        {/* Status Message */}
                                        {project.status === 'PENDING_APPROVAL' && (
                                            <p className="text-xs text-orange-600 font-medium text-center">
                                                ⏳ Đang chờ quản trị viên duyệt
                                            </p>
                                        )}
                                        {project.status === 'COMPLETED' && (
                                            <p className="text-xs text-green-600 font-medium text-center">
                                                ✅ Dự án đã hoàn thành
                                            </p>
                                        )}
                                        {updatingProgress === project.id && (
                                            <p className="text-xs text-blue-600 font-medium text-center">
                                                Đang cập nhật...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sub Projects */}
                            {project.children && project.children.length > 0 && (
                                <div className="border-t border-gray-200 pt-4 mt-2">
                                    <button
                                        onClick={() => toggleExpanded(project.id)}
                                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                                    >
                                        {expandedProjects.has(project.id) ? (
                                            <ChevronDown size={16} />
                                        ) : (
                                            <ChevronRight size={16} />
                                        )}
                                        <FolderTree size={16} className="text-blue-500" />
                                        <span>Dự án con ({project.children.length})</span>
                                    </button>

                                    {expandedProjects.has(project.id) && (
                                        <div className="mt-3 space-y-2 pl-6">
                                            {project.children.map(child => (
                                                <Link
                                                    key={child.id}
                                                    to={`/projects/${child.id}`}
                                                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors group"
                                                >
                                                    <div className={`p-1.5 rounded-lg text-white ${
                                                        child.status === 'COMPLETED' ? 'bg-green-500' :
                                                        child.status === 'PENDING_APPROVAL' ? 'bg-orange-500' : 'bg-blue-500'
                                                    }`}>
                                                        <FolderTree size={12} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                                                            {child.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{child.code}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <span className={`text-sm font-bold ${
                                                                child.status === 'COMPLETED' ? 'text-green-600' :
                                                                child.status === 'PENDING_APPROVAL' ? 'text-orange-600' : 'text-blue-600'
                                                            }`}>
                                                                {child.progress}%
                                                            </span>
                                                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                                                                <div 
                                                                    className={`h-full rounded-full ${
                                                                        child.status === 'COMPLETED' ? 'bg-green-500' :
                                                                        child.status === 'PENDING_APPROVAL' ? 'bg-orange-500' : 'bg-blue-500'
                                                                    }`}
                                                                    style={{ width: `${child.progress}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default UserProjects;
