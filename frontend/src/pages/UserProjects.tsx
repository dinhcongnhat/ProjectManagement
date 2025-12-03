import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Calendar, User, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

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
}

const UserProjects = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const { token, user } = useAuth();
    const [updatingProgress, setUpdatingProgress] = useState<number | null>(null);

    const fetchProjects = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/projects`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (Array.isArray(data)) {
                // Filter projects where user is involved
                const myProjects = data.filter((project: Project) =>
                    project.manager?.id === user?.id ||
                    project.implementers?.some((imp: { id: number }) => imp.id === user?.id) ||
                    project.followers?.some((fol: { id: number }) => fol.id === user?.id)
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
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Dự án của tôi</h2>

            <div className="grid grid-cols-1 gap-6">
                {projects.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500">
                        Chưa có dự án nào được giao cho bạn.
                    </div>
                ) : (
                    projects.map((project) => (
                        <div key={project.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                {/* Left: Project Info */}
                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                                                <Briefcase size={24} />
                                            </div>
                                            <div>
                                                <Link to={`/projects/${project.id}`} className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
                                                    {project.name}
                                                </Link>
                                                <p className="text-sm text-gray-500 mt-1">Mã: {project.code}</p>
                                            </div>
                                        </div>
                                        {getStatusBadge(project.status)}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <User size={16} className="text-gray-400" />
                                            <span>PM: {project.manager?.name || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Calendar size={16} className="text-gray-400" />
                                            <span>
                                                {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'} -
                                                {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Progress Control */}
                                <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 pt-4 lg:pt-0 lg:pl-6">
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
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default UserProjects;
