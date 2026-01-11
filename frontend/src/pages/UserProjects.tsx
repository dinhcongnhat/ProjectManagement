import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Calendar, User, CheckCircle2, Clock, AlertCircle, FolderTree, ChevronRight, ChevronDown, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { useDialog } from '../components/ui/Dialog';

interface SubProject {
    id: number;
    code: string;
    name: string;
    progress: number;
    status: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED';
    startDate: string;
    endDate: string;
    manager?: { id: number, name: string };
    children?: SubProject[]; // Nested children
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
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { showError } = useDialog();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                showError('Không thể cập nhật tiến độ');
            }
        } catch (error) {
            console.error('Error updating progress:', error);
            showError('Có lỗi xảy ra khi cập nhật tiến độ');
        } finally {
            setUpdatingProgress(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            'COMPLETED': {
                bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
                text: 'Hoàn thành',
                icon: CheckCircle2
            },
            'PENDING_APPROVAL': {
                bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
                text: 'Chờ duyệt',
                icon: Clock
            },
            'IN_PROGRESS': {
                bg: 'bg-gradient-to-r from-blue-500 to-indigo-500',
                text: 'Đang thực hiện',
                icon: AlertCircle
            }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['IN_PROGRESS'];
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${config.bg} text-white text-xs font-medium rounded-full shadow-lg shadow-blue-500/20`}>
                <Icon size={12} />
                {config.text}
            </span>
        );
    };

    // Filter projects based on search query
    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const query = searchQuery.toLowerCase();
        return projects.filter(project =>
            project.name.toLowerCase().includes(query) ||
            project.code.toLowerCase().includes(query) ||
            project.manager?.name?.toLowerCase().includes(query) ||
            project.children?.some(child =>
                child.name.toLowerCase().includes(query) ||
                child.code.toLowerCase().includes(query)
            )
        );
    }, [projects, searchQuery]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Dự án của tôi</h2>
                        <p className="text-gray-500 mt-1">Quản lý và theo dõi tiến độ dự án</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Briefcase size={18} className="text-blue-600" />
                        <span className="font-medium">{filteredProjects.length} dự án</span>
                    </div>
                </div>

                {/* Search Bar with Dropdown */}
                <div className="relative" ref={searchRef}>
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search size={20} className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowSearchDropdown(true);
                        }}
                        onFocus={() => searchQuery && setShowSearchDropdown(true)}
                        placeholder="Tìm kiếm dự án theo tên, mã hoặc quản trị..."
                        className="w-full pl-12 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setShowSearchDropdown(false);
                            }}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                        >
                            <X size={18} />
                        </button>
                    )}

                    {/* Search Dropdown Results */}
                    {showSearchDropdown && searchQuery && filteredProjects.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 max-h-96 overflow-y-auto z-50">
                            <div className="p-2">
                                <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                    Kết quả tìm kiếm ({filteredProjects.length})
                                </p>
                                {filteredProjects.slice(0, 8).map((project) => (
                                    <div
                                        key={project.id}
                                        onClick={() => {
                                            navigate(`/projects/${project.id}`);
                                            setShowSearchDropdown(false);
                                        }}
                                        className="flex items-center gap-3 px-3 py-3 hover:bg-blue-50 cursor-pointer rounded-lg transition-colors group"
                                    >
                                        <div className={`p-2 rounded-lg text-white ${project.status === 'COMPLETED' ? 'bg-gradient-to-br from-emerald-500 to-green-500' :
                                                project.status === 'PENDING_APPROVAL' ? 'bg-gradient-to-br from-amber-500 to-orange-500' :
                                                    'bg-gradient-to-br from-blue-500 to-indigo-500'
                                            }`}>
                                            <Briefcase size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                                                {project.name}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className="font-mono">{project.code}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <User size={10} />
                                                    {project.manager?.name || 'Chưa gán'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${project.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                    project.status === 'PENDING_APPROVAL' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-blue-100 text-blue-700'
                                                }`}>
                                                {project.progress}%
                                            </span>
                                            <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
                                        </div>
                                    </div>
                                ))}
                                {filteredProjects.length > 8 && (
                                    <p className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-100">
                                        Còn {filteredProjects.length - 8} dự án khác...
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* No Results */}
                    {showSearchDropdown && searchQuery && filteredProjects.length === 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-6 text-center z-50">
                            <Search size={32} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500 text-sm">Không tìm thấy dự án nào</p>
                            <p className="text-gray-400 text-xs mt-1">Thử tìm với từ khóa khác</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {filteredProjects.length === 0 ? (
                    <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            {searchQuery ? <Search size={32} className="text-gray-400" /> : <Briefcase size={32} className="text-gray-400" />}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            {searchQuery ? 'Không tìm thấy dự án' : 'Chưa có dự án'}
                        </h3>
                        <p className="text-gray-500">
                            {searchQuery
                                ? `Không có dự án nào khớp với "${searchQuery}"`
                                : 'Chưa có dự án nào được giao cho bạn.'}
                        </p>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="mt-4 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
                            >
                                Xóa bộ lọc
                            </button>
                        )}
                    </div>
                ) : (
                    filteredProjects.map((project) => (
                        <div key={project.id} className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all duration-300 overflow-hidden">
                            {/* Project Header */}
                            <div className="p-5 lg:p-6">
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                    {/* Left: Project Info */}
                                    <div className="flex-1">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/30 shrink-0">
                                                <Briefcase size={24} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-3 flex-wrap mb-2">
                                                    <Link to={`/projects/${project.id}`} className="text-lg lg:text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
                                                        {project.name}
                                                    </Link>
                                                    {getStatusBadge(project.status)}
                                                </div>
                                                <p className="text-sm text-gray-500 mb-3">Mã dự án: <span className="font-medium text-gray-700">{project.code}</span></p>

                                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                                    <div className="flex items-center gap-2">
                                                        <User size={14} className="text-gray-400" />
                                                        <span>PM: <span className="font-medium">{project.manager?.name || 'N/A'}</span></span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={14} className="text-gray-400" />
                                                        <span>
                                                            {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'} -
                                                            {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Progress Control */}
                                    <div className="lg:w-64 shrink-0">
                                        <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50/50 rounded-xl border border-gray-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-medium text-gray-700">Tiến độ</span>
                                                <span className="text-2xl font-bold text-blue-600">{project.progress}%</span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${project.status === 'COMPLETED' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                                                        project.status === 'PENDING_APPROVAL' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                                                            'bg-gradient-to-r from-blue-500 to-indigo-500'
                                                        }`}
                                                    style={{ width: `${project.progress}%` }}
                                                />
                                            </div>

                                            {/* Progress Slider */}
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={project.progress}
                                                onChange={(e) => handleProgressChange(project.id, Number(e.target.value))}
                                                disabled={project.status === 'COMPLETED' || project.status === 'PENDING_APPROVAL' || updatingProgress === project.id}
                                                className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${project.status === 'COMPLETED' || project.status === 'PENDING_APPROVAL' ? 'opacity-50 cursor-not-allowed' : ''
                                                    }`}
                                                title={`Tiến độ: ${project.progress}%`}
                                            />

                                            {/* Status Message */}
                                            {project.status === 'PENDING_APPROVAL' && (
                                                <p className="text-xs text-orange-600 font-medium text-center mt-2">
                                                    ⏳ Đang chờ duyệt
                                                </p>
                                            )}
                                            {project.status === 'COMPLETED' && (
                                                <p className="text-xs text-green-600 font-medium text-center mt-2">
                                                    ✅ Đã hoàn thành
                                                </p>
                                            )}
                                            {updatingProgress === project.id && (
                                                <p className="text-xs text-blue-600 font-medium text-center mt-2">
                                                    Đang cập nhật...
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sub Projects - Recursive Render */}
                            {project.children && project.children.length > 0 && (
                                <div className="border-t border-gray-100 px-5 lg:px-6 py-4 bg-gray-50/50">
                                    <button
                                        onClick={() => toggleExpanded(project.id)}
                                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                                    >
                                        {expandedProjects.has(project.id) ? (
                                            <ChevronDown size={16} />
                                        ) : (
                                            <ChevronRight size={16} />
                                        )}
                                        <FolderTree size={16} className="text-purple-500" />
                                        <span>Dự án con ({project.children.length})</span>
                                    </button>

                                    {expandedProjects.has(project.id) && (
                                        <div className="mt-3 space-y-2 pl-6">
                                            {project.children.map(child => (
                                                <div key={child.id}>
                                                    {/* Child Project Link */}
                                                    <Link
                                                        to={`/projects/${child.id}`}
                                                        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
                                                    >
                                                        <div className={`p-2 rounded-lg text-white ${child.status === 'COMPLETED' ? 'bg-gradient-to-br from-emerald-500 to-green-500' :
                                                            child.status === 'PENDING_APPROVAL' ? 'bg-gradient-to-br from-amber-500 to-orange-500' :
                                                                'bg-gradient-to-br from-blue-500 to-indigo-500'
                                                            }`}>
                                                            <FolderTree size={14} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                                                                {child.name}
                                                                {child.children && child.children.length > 0 && (
                                                                    <span className="ml-2 text-xs text-purple-500">
                                                                        ({child.children.length} dự án con)
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-gray-500">{child.code}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <span className={`text-sm font-bold ${child.status === 'COMPLETED' ? 'text-green-600' :
                                                                    child.status === 'PENDING_APPROVAL' ? 'text-orange-600' : 'text-blue-600'
                                                                    }`}>
                                                                    {child.progress}%
                                                                </span>
                                                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                                                                    <div
                                                                        className={`h-full rounded-full ${child.status === 'COMPLETED' ? 'bg-green-500' :
                                                                            child.status === 'PENDING_APPROVAL' ? 'bg-orange-500' : 'bg-blue-500'
                                                                            }`}
                                                                        style={{ width: `${child.progress}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                            {child.children && child.children.length > 0 ? (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        toggleExpanded(child.id);
                                                                    }}
                                                                    className="p-1 hover:bg-gray-100 rounded"
                                                                >
                                                                    {expandedProjects.has(child.id) ? (
                                                                        <ChevronDown size={16} className="text-gray-400" />
                                                                    ) : (
                                                                        <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
                                                                    )}
                                                                </button>
                                                            ) : (
                                                                <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
                                                            )}
                                                        </div>
                                                    </Link>

                                                    {/* Nested Children (Level 3) */}
                                                    {child.children && child.children.length > 0 && expandedProjects.has(child.id) && (
                                                        <div className="mt-2 ml-8 space-y-2">
                                                            {child.children.map(grandChild => (
                                                                <Link
                                                                    key={grandChild.id}
                                                                    to={`/projects/${grandChild.id}`}
                                                                    className="flex items-center gap-3 p-2.5 bg-purple-50 rounded-lg border border-purple-100 hover:border-purple-300 hover:shadow-sm transition-all group"
                                                                >
                                                                    <div className={`p-1.5 rounded-lg text-white ${grandChild.status === 'COMPLETED' ? 'bg-gradient-to-br from-emerald-500 to-green-500' :
                                                                        grandChild.status === 'PENDING_APPROVAL' ? 'bg-gradient-to-br from-amber-500 to-orange-500' :
                                                                            'bg-gradient-to-br from-purple-500 to-indigo-500'
                                                                        }`}>
                                                                        <FolderTree size={12} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-purple-600">
                                                                            {grandChild.name}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500">{grandChild.code}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-xs font-bold ${grandChild.status === 'COMPLETED' ? 'text-green-600' :
                                                                            grandChild.status === 'PENDING_APPROVAL' ? 'text-orange-600' : 'text-purple-600'
                                                                            }`}>
                                                                            {grandChild.progress}%
                                                                        </span>
                                                                        <ChevronRight size={14} className="text-gray-400 group-hover:text-purple-600" />
                                                                    </div>
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
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
