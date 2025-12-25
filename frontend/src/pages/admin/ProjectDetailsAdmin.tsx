import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import {
    ArrowLeft, Calendar, Users, Eye, Clock, CheckCircle2,
    AlertCircle, FileText, X, MessageSquare, History, FolderTree,
    Plus, ChevronRight, Briefcase, Target, TrendingUp,
    Loader2
} from 'lucide-react';
import { DiscussionPanel } from '../../components/DiscussionPanel';
import { ActivityHistoryPanel } from '../../components/ActivityHistoryPanel';
import { OnlyOfficeViewer } from '../../components/OnlyOfficeViewer';
import { ProjectAttachments } from '../../components/ProjectAttachments';
import { ProjectWorkflow } from '../../components/ProjectWorkflow';
import { useDialog } from '../../components/ui/Dialog';

interface WorkflowData {
    id: number;
    projectId: number;
    currentStatus: 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'SENT_TO_CUSTOMER';
    receivedStartAt: string | null;
    receivedConfirmedAt: string | null;
    inProgressStartAt: string | null;
    inProgressConfirmedAt: string | null;
    completedStartAt: string | null;
    completedConfirmedAt: string | null;
    completedApprovedAt: string | null;
    completedApprovedBy: { id: number; name: string } | null;
    sentToCustomerAt: string | null;
}

interface SubProject {
    id: number;
    code: string;
    name: string;
    progress: number;
    status: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED';
    startDate: string;
    endDate: string;
    manager?: { id: number, name: string };
}

interface ProjectAttachmentType {
    id: number;
    name: string;
    minioPath: string;
    fileType: string;
    fileSize: number;
    category: 'TaiLieuDinhKem' | 'NhanVienDinhKem';
    createdAt: string;
    uploadedBy: {
        id: number;
        name: string;
        role: string;
    };
}

interface Project {
    id: number;
    code: string;
    name: string;
    investor?: string;
    manager: { id: number, name: string };
    implementers: { id: number, name: string }[];
    followers: { id: number, name: string }[];
    cooperators?: { id: number, name: string }[];
    startDate: string;
    endDate: string;
    duration: string;
    group: string;
    value: string;
    progressMethod: string;
    description: string;
    attachment?: string;
    attachments?: ProjectAttachmentType[];
    progress: number;
    status: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED';
    parentId?: number;
    parent?: { id: number, name: string, code: string };
    children?: SubProject[];
    workflow?: WorkflowData;
}

const ProjectDetailsAdmin = () => {
    const { id } = useParams();
    const { token, user } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'workflow' | 'discussion' | 'activity'>('info');
    const [showOnlyOffice, setShowOnlyOffice] = useState(false);
    const { showConfirm, showSuccess, showError } = useDialog();

    const fetchProject = async () => {
        try {
            const response = await fetch(`${API_URL}/projects/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setProject(data);
            }
        } catch (error) {
            console.error('Error fetching project:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token && id) fetchProject();
    }, [token, id]);

    const handleApprove = async () => {
        if (!project) return;

        const confirmed = await showConfirm('Bạn có chắc chắn muốn duyệt và hoàn thành dự án này?');
        if (!confirmed) return;

        setApproving(true);
        try {
            const response = await fetch(`${API_URL}/projects/${project.id}/approve`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const updatedProject = await response.json();
                setProject(updatedProject);
                showSuccess('Dự án đã được duyệt và chuyển sang trạng thái hoàn thành!');
            } else {
                showError('Không thể duyệt dự án');
            }
        } catch (error) {
            console.error('Error approving project:', error);
            showError('Có lỗi xảy ra khi duyệt dự án');
        } finally {
            setApproving(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            'COMPLETED': {
                bg: 'bg-green-500',
                text: 'Hoàn thành',
                icon: CheckCircle2
            },
            'PENDING_APPROVAL': {
                bg: 'bg-orange-500',
                text: 'Chờ duyệt',
                icon: Clock
            },
            'IN_PROGRESS': {
                bg: 'bg-blue-500',
                text: 'Đang thực hiện',
                icon: TrendingUp
            }
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['IN_PROGRESS'];
        const Icon = config.icon;

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${config.bg} text-white text-sm font-medium rounded-full shadow-lg shadow-blue-500/20`}>
                <Icon size={14} />
                {config.text}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-blue-200 rounded-full" />
                        <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" />
                    </div>
                    <p className="text-gray-600 font-medium">Đang tải dự án...</p>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
                <div className="text-center bg-white rounded-2xl p-8 shadow-xl shadow-gray-200/50">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Không tìm thấy dự án</h2>
                    <p className="text-gray-500 mb-4">Dự án này không tồn tại hoặc bạn không có quyền truy cập.</p>
                    <Link
                        to="/admin/projects"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
                    >
                        <ArrowLeft size={16} />
                        Quay lại
                    </Link>
                </div>
            </div>
        );
    }

    const isManager = project.manager?.id === user?.id;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
            {/* Header with solid color */}
            <div className="bg-blue-600 text-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <Link
                                to="/admin/projects"
                                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm"
                            >
                                <ArrowLeft size={22} />
                            </Link>
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 bg-white/15 backdrop-blur-sm rounded-lg text-sm font-medium">
                                        {project.code}
                                    </span>
                                    {project.parent && (
                                        <span className="px-2.5 py-1 bg-purple-500/30 rounded-lg text-xs font-medium flex items-center gap-1">
                                            <FolderTree size={12} />
                                            Dự án con
                                        </span>
                                    )}
                                    <span className="px-2.5 py-1 bg-red-500/30 rounded-lg text-xs font-medium">
                                        Admin View
                                    </span>
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-bold mb-1">{project.name}</h1>
                                {project.investor && (
                                    <p className="text-blue-200 text-sm">
                                        Chủ đầu tư: <span className="text-white font-medium">{project.investor}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {getStatusBadge(project.status)}
                            {project.status === 'PENDING_APPROVAL' && (
                                <button
                                    onClick={handleApprove}
                                    disabled={approving}
                                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/30 disabled:opacity-50 flex items-center gap-2 transition-all duration-200"
                                >
                                    {approving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                    {approving ? 'Đang duyệt...' : 'Duyệt hoàn thành'}
                                </button>
                            )}
                        </div>
                    </div>


                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                {/* Modern Tabs */}
                <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-2">
                    <div className="flex gap-2">
                        {[
                            { id: 'info', label: 'Thông tin', icon: FileText },
                            { id: 'workflow', label: 'Tiến trình', icon: Target },
                            { id: 'discussion', label: 'Thảo luận', icon: MessageSquare },
                            { id: 'activity', label: 'Lịch sử', icon: History }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all ${isActive
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    <Icon size={18} />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'info' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 group hover:shadow-md transition-shadow">
                                    <div className="p-3 bg-blue-50 rounded-xl w-fit mb-3">
                                        <Calendar size={20} className="text-blue-600" />
                                    </div>
                                    <p className="text-xs text-gray-500 font-medium mb-0.5">Ngày bắt đầu</p>
                                    <p className="font-bold text-gray-900">
                                        {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 group hover:shadow-md transition-shadow">
                                    <div className="p-3 bg-orange-50 rounded-xl w-fit mb-3">
                                        <Clock size={20} className="text-orange-600" />
                                    </div>
                                    <p className="text-xs text-gray-500 font-medium mb-0.5">Ngày kết thúc dự kiến</p>
                                    <p className="font-bold text-gray-900">
                                        {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 bg-blue-600 rounded-xl text-white">
                                        <FileText size={20} />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">Mô tả dự án</h2>
                                </div>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {project.description || (
                                        <span className="text-gray-400 italic">Chưa có mô tả cho dự án này.</span>
                                    )}
                                </div>
                            </div>

                            {/* Details Grid */}


                            {/* Project Attachments */}
                            <ProjectAttachments
                                projectId={project.id}
                                projectName={project.name}
                                projectStatus={project.status}
                                canUpload={true}
                                isImplementer={false}
                                isAdmin={true}
                                isManager={isManager}
                                attachments={project.attachments}
                                onRefresh={fetchProject}
                            />
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Team Members Card */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="p-2.5 bg-violet-600 rounded-xl text-white">
                                        <Users size={20} />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">Thành viên dự án</h2>
                                </div>

                                {/* Manager */}
                                {project.manager?.name && (
                                    <div className="mb-5">
                                        <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">Quản trị dự án</p>
                                        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                                            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                                {project.manager.name.charAt(0)}
                                            </div>
                                            <span className="font-semibold text-gray-900">{project.manager.name}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Implementers */}
                                {project.implementers && project.implementers.length > 0 && (
                                    <div className="mb-5">
                                        <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide flex items-center gap-2">
                                            <Users size={14} />
                                            Người thực hiện ({project.implementers.length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {project.implementers.map(user => (
                                                <span
                                                    key={user.id}
                                                    className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-full"
                                                >
                                                    {user.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Cooperators */}
                                {project.cooperators && project.cooperators.length > 0 && (
                                    <div>
                                        <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide flex items-center gap-2">
                                            <Briefcase size={14} />
                                            Phối hợp thực hiện ({project.cooperators.length})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {project.cooperators.map(user => (
                                                <span
                                                    key={user.id}
                                                    className="px-3 py-1.5 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 text-sm font-medium rounded-full"
                                                >
                                                    {user.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Parent Project */}
                            {project.parent && (
                                <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-100 border border-gray-100">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
                                            <FolderTree size={20} />
                                        </div>
                                        <h2 className="text-lg font-bold text-gray-900">Dự án cha</h2>
                                    </div>
                                    <Link
                                        to={`/admin/projects/${project.parent.id}`}
                                        className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors group"
                                    >
                                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                                            <FolderTree size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-600">
                                                {project.parent.name}
                                            </p>
                                            <p className="text-xs text-gray-500">Mã: {project.parent.code}</p>
                                        </div>
                                        <ChevronRight size={18} className="text-gray-400 group-hover:text-indigo-600" />
                                    </Link>
                                </div>
                            )}

                            {/* Sub Projects */}
                            <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-100 border border-gray-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-cyan-600 rounded-xl text-white">
                                            <FolderTree size={20} />
                                        </div>
                                        <h2 className="text-lg font-bold text-gray-900">
                                            Dự án con ({project.children?.length || 0})
                                        </h2>
                                    </div>
                                    <Link
                                        to={`/admin/create-project?parentId=${project.id}`}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all shadow-md"
                                    >
                                        <Plus size={16} />
                                        Thêm
                                    </Link>
                                </div>

                                {project.children && project.children.length > 0 ? (
                                    <div className="space-y-3">
                                        {project.children.map(child => (
                                            <Link
                                                key={child.id}
                                                to={`/admin/projects/${child.id}`}
                                                className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors group border border-transparent hover:border-blue-200"
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${child.status === 'COMPLETED' ? 'bg-green-600' :
                                                    child.status === 'PENDING_APPROVAL' ? 'bg-orange-500' :
                                                        'bg-blue-600'
                                                    }`}>
                                                    <FolderTree size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600">
                                                        {child.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-500">{child.code}</span>
                                                        <span className="text-xs text-gray-400">•</span>
                                                        <span className={`text-xs font-semibold ${child.status === 'COMPLETED' ? 'text-green-600' :
                                                            child.status === 'PENDING_APPROVAL' ? 'text-orange-600' : 'text-blue-600'
                                                            }`}>
                                                            {child.progress}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${child.status === 'COMPLETED' ? 'bg-green-500' :
                                                                child.status === 'PENDING_APPROVAL' ? 'bg-orange-500' :
                                                                    'bg-blue-500'
                                                                }`}
                                                            style={{ width: `${child.progress}%` }}
                                                        />
                                                    </div>
                                                    <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <FolderTree size={40} className="text-gray-300 mx-auto mb-2" />
                                        <p className="text-gray-400 text-sm">Chưa có dự án con</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'workflow' && (
                    <ProjectWorkflow
                        projectId={project.id}
                        workflow={project.workflow || null}
                        isManager={isManager}
                        isImplementer={project.implementers?.some(imp => imp.id === user?.id) || false}
                        isAdmin={true}
                        token={token || ''}
                        onRefresh={fetchProject}
                    />
                )}

                {activeTab === 'discussion' && (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 sticky top-4" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
                        <DiscussionPanel projectId={project.id} />
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 sticky top-4">
                        <ActivityHistoryPanel projectId={project.id} />
                    </div>
                )}
            </div>

            {/* OnlyOffice Viewer Modal */}
            {showOnlyOffice && (
                <OnlyOfficeViewer
                    projectId={project.id}
                    onClose={() => setShowOnlyOffice(false)}
                    token={token || ''}
                />
            )}

            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-5xl max-h-[90vh]">
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}

            {/* Add shimmer animation */}
            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite;
                }
            `}</style>
        </div>
    );
};

export default ProjectDetailsAdmin;
