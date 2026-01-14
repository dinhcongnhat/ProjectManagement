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
    cooperators: { id: number, name: string }[];
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
    const [projectPage, setProjectPage] = useState(1);
    const PROJECTS_PER_PAGE = 15;
    const SUBPROJECTS_PER_PAGE = 10;
    const [subProjectPages, setSubProjectPages] = useState<Record<number, number>>({});
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

    const getSubProjectPage = (projectId: number) => subProjectPages[projectId] || 1;
    const setSubProjectPage = (projectId: number, page: number) => {
        setSubProjectPages(prev => ({ ...prev, [projectId]: page }));
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
                        project.cooperators?.some((coop: { id: number }) => coop.id === user?.id) ||
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
                <div className="relative group" ref={searchRef}>
                    <div className="relative w-full p-[1.5px] rounded-xl bg-gray-200 group-focus-within:bg-gradient-to-r group-focus-within:from-blue-500 group-focus-within:via-purple-500 group-focus-within:to-pink-500 transition-all duration-500">
                        <div className="relative w-full bg-white rounded-[10.5px] flex items-center h-full">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                <Search size={20} className="text-gray-400 group-focus-within:text-blue-600 transition-colors" />
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
                                className="w-full pl-12 pr-10 py-3 bg-transparent border-none focus:ring-0 text-sm outline-none rounded-[10.5px]"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setShowSearchDropdown(false);
                                    }}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 z-10"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

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
                    (() => {
                        const totalProjects = filteredProjects.length;
                        const totalPages = Math.ceil(totalProjects / PROJECTS_PER_PAGE);
                        const startIndex = (projectPage - 1) * PROJECTS_PER_PAGE;
                        const endIndex = startIndex + PROJECTS_PER_PAGE;
                        const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

                        return (
                            <>
                                {paginatedProjects.map((project) => (
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

                                                {/* Right: Progress & Action */}
                                                <div className="flex items-center gap-4 lg:flex-col lg:items-end">
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Tiến độ</p>
                                                            {/* Calculate progress from children if they exist */}
                                                            {(() => {
                                                                const children = project.children ?? [];
                                                                const hasChildren = children.length > 0;
                                                                const calculatedProgress = hasChildren
                                                                    ? Math.round(children.reduce((sum, child) => sum + (child.progress || 0), 0) / children.length)
                                                                    : project.progress;
                                                                return (
                                                                    <p className={`text-2xl font-bold ${calculatedProgress >= 100 ? 'text-green-600' :
                                                                        calculatedProgress >= 50 ? 'text-blue-600' : 'text-orange-500'
                                                                        }`}>
                                                                        {calculatedProgress}%
                                                                    </p>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <Link
                                                        to={`/projects/${project.id}`}
                                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
                                                    >
                                                        Chi tiết
                                                        <ChevronRight size={16} />
                                                    </Link>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            {(() => {
                                                const children = project.children ?? [];
                                                const hasChildren = children.length > 0;
                                                const calculatedProgress = hasChildren
                                                    ? Math.round(children.reduce((sum, child) => sum + (child.progress || 0), 0) / children.length)
                                                    : project.progress;
                                                return (
                                                    <div className="mt-5 pt-5 border-t border-gray-100">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-gray-700">Tiến độ thực tế</span>
                                                                {hasChildren && (
                                                                    <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                                                                        Tự động từ {children.length} dự án con
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {/* Only show input if no children and user has permission */}
                                                                {!hasChildren && project.status !== 'COMPLETED' && (project.manager?.id === user?.id || project.implementers?.some(i => i.id === user?.id) || project.cooperators?.some(c => c.id === user?.id)) && (
                                                                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="100"
                                                                            defaultValue={project.progress}
                                                                            disabled={updatingProgress === project.id}
                                                                            className="w-14 px-2 py-1 text-sm text-center border border-gray-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    const target = e.target as HTMLInputElement;
                                                                                    const value = Math.min(100, Math.max(0, parseInt(target.value) || 0));
                                                                                    handleProgressChange(project.id, value);
                                                                                }
                                                                            }}
                                                                            onBlur={(e) => {
                                                                                const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                                                if (value !== project.progress) {
                                                                                    handleProgressChange(project.id, value);
                                                                                }
                                                                            }}
                                                                        />
                                                                        <span className="text-sm text-gray-500">%</span>
                                                                    </div>
                                                                )}
                                                                {/* Show calculated progress for parent projects */}
                                                                {hasChildren && (
                                                                    <span className={`text-lg font-bold ${calculatedProgress >= 100 ? 'text-green-600' :
                                                                        calculatedProgress >= 50 ? 'text-blue-600' : 'text-orange-500'
                                                                        }`}>
                                                                        {calculatedProgress}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${calculatedProgress >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                                                    calculatedProgress >= 50 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                                                                        'bg-gradient-to-r from-orange-400 to-amber-500'
                                                                    }`}
                                                                style={{ width: `${Math.min(calculatedProgress, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Sub-projects Section */}
                                        {project.children && project.children.length > 0 && (
                                            <div className="border-t border-gray-100">
                                                <button
                                                    onClick={() => toggleExpanded(project.id)}
                                                    className="w-full flex items-center justify-between px-5 lg:px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-50/50 hover:from-gray-100 hover:to-gray-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-1.5 bg-orange-100 rounded-lg">
                                                            <FolderTree size={16} className="text-orange-600" />
                                                        </div>
                                                        <span className="text-sm font-semibold text-gray-700">
                                                            {project.children.length} Dự án con
                                                        </span>
                                                    </div>
                                                    <div className={`transform transition-transform duration-200 ${expandedProjects.has(project.id) ? 'rotate-180' : ''}`}>
                                                        <ChevronDown size={18} className="text-gray-400" />
                                                    </div>
                                                </button>

                                                {expandedProjects.has(project.id) && (() => {
                                                    const currentSubPage = getSubProjectPage(project.id);
                                                    const totalSubProjects = project.children.length;
                                                    const totalSubPages = Math.ceil(totalSubProjects / SUBPROJECTS_PER_PAGE);
                                                    const subStartIndex = (currentSubPage - 1) * SUBPROJECTS_PER_PAGE;
                                                    const subEndIndex = subStartIndex + SUBPROJECTS_PER_PAGE;
                                                    const paginatedChildren = project.children.slice(subStartIndex, subEndIndex);

                                                    return (
                                                        <div className="px-5 lg:px-6 py-4 bg-gray-50/50 space-y-2">
                                                            {paginatedChildren.map(child => (
                                                                <div key={child.id} className="space-y-2">
                                                                    <Link
                                                                        to={`/projects/${child.id}`}
                                                                        className="flex items-center gap-3 p-3 bg-white rounded-xl hover:bg-orange-50 border border-gray-100 hover:border-orange-200 transition-all group"
                                                                    >
                                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${child.status === 'COMPLETED' ? 'bg-green-500' :
                                                                            child.status === 'PENDING_APPROVAL' ? 'bg-orange-500' : 'bg-blue-500'
                                                                            }`}>
                                                                            <FolderTree size={14} />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium text-gray-800 truncate group-hover:text-orange-600">{child.name}</p>
                                                                            <p className="text-xs text-gray-500">{child.code}</p>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-xs font-bold ${child.status === 'COMPLETED' ? 'text-green-600' :
                                                                                child.status === 'PENDING_APPROVAL' ? 'text-orange-600' : 'text-blue-600'
                                                                                }`}>
                                                                                {child.progress}%
                                                                            </span>
                                                                            <ChevronRight size={14} className="text-gray-400 group-hover:text-orange-600" />
                                                                        </div>
                                                                    </Link>

                                                                    {/* Grandchildren (3rd level) */}
                                                                    {child.children && child.children.length > 0 && (
                                                                        <div className="ml-11 space-y-1.5">
                                                                            {child.children.map(grandChild => (
                                                                                <Link
                                                                                    key={grandChild.id}
                                                                                    to={`/projects/${grandChild.id}`}
                                                                                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-purple-50 border border-gray-100 hover:border-purple-200 transition-all group"
                                                                                >
                                                                                    <div className={`w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0 ${grandChild.status === 'COMPLETED' ? 'bg-green-400' :
                                                                                        grandChild.status === 'PENDING_APPROVAL' ? 'bg-orange-400' : 'bg-purple-400'
                                                                                        }`}>
                                                                                        <FolderTree size={10} />
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className="text-xs font-medium text-gray-700 truncate group-hover:text-purple-600">{grandChild.name}</p>
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

                                                            {/* Sub-project Pagination */}
                                                            {totalSubPages > 1 && (
                                                                <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200">
                                                                    <span className="text-xs text-gray-500">
                                                                        {subStartIndex + 1} - {Math.min(subEndIndex, totalSubProjects)} / {totalSubProjects}
                                                                    </span>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setSubProjectPage(project.id, Math.max(1, currentSubPage - 1)); }}
                                                                            disabled={currentSubPage === 1}
                                                                            className="px-2 py-1 text-xs rounded disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-600"
                                                                        >
                                                                            ←
                                                                        </button>
                                                                        {Array.from({ length: totalSubPages }, (_, i) => i + 1).map(page => (
                                                                            <button
                                                                                key={page}
                                                                                onClick={(e) => { e.stopPropagation(); setSubProjectPage(project.id, page); }}
                                                                                className={`w-6 h-6 text-xs rounded ${currentSubPage === page ? 'bg-orange-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                                                                            >
                                                                                {page}
                                                                            </button>
                                                                        ))}
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setSubProjectPage(project.id, Math.min(totalSubPages, currentSubPage + 1)); }}
                                                                            disabled={currentSubPage === totalSubPages}
                                                                            className="px-2 py-1 text-xs rounded disabled:opacity-50 bg-orange-500 hover:bg-orange-600 text-white"
                                                                        >
                                                                            →
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 p-4">
                                        <span className="text-sm text-gray-500">
                                            Hiển thị {startIndex + 1} - {Math.min(endIndex, totalProjects)} / {totalProjects} dự án
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setProjectPage(p => Math.max(1, p - 1))}
                                                disabled={projectPage === 1}
                                                className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                            >
                                                ← Trước
                                            </button>
                                            <div className="flex items-center gap-1">
                                                {(() => {
                                                    const pages: (number | string)[] = [];
                                                    if (totalPages <= 7) {
                                                        // Show all pages if 7 or less
                                                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                                                    } else {
                                                        // Always show first page
                                                        pages.push(1);

                                                        if (projectPage > 3) {
                                                            pages.push('...');
                                                        }

                                                        // Show pages around current page
                                                        const start = Math.max(2, projectPage - 1);
                                                        const end = Math.min(totalPages - 1, projectPage + 1);

                                                        for (let i = start; i <= end; i++) {
                                                            if (!pages.includes(i)) pages.push(i);
                                                        }

                                                        if (projectPage < totalPages - 2) {
                                                            pages.push('...');
                                                        }

                                                        // Always show last page
                                                        if (!pages.includes(totalPages)) pages.push(totalPages);
                                                    }

                                                    return pages.map((page, idx) => (
                                                        page === '...' ? (
                                                            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                                                        ) : (
                                                            <button
                                                                key={page}
                                                                onClick={() => setProjectPage(page as number)}
                                                                className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${projectPage === page
                                                                    ? 'bg-blue-600 text-white'
                                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                                                    }`}
                                                            >
                                                                {page}
                                                            </button>
                                                        )
                                                    ));
                                                })()}
                                            </div>
                                            <button
                                                onClick={() => setProjectPage(p => Math.min(totalPages, p + 1))}
                                                disabled={projectPage === totalPages}
                                                className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                            >
                                                Sau →
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()
                )}
            </div>
        </div>
    );
};

export default UserProjects;
