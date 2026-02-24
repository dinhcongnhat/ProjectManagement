import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    ArrowLeft, Users, X, FileText,
    MessageSquare, History, CheckCircle2, FolderTree, ChevronRight, ChevronLeft,
    Briefcase, Target, Loader2, AlertCircle, Calendar, Clock, Flag, Plus, FileSpreadsheet, Download, Edit3
} from 'lucide-react';
import { DiscussionPanel } from '../components/DiscussionPanel';
import { ActivityHistoryPanel } from '../components/ActivityHistoryPanel';
import { ProjectAttachments } from '../components/ProjectAttachments';
import { ProjectWorkflow } from '../components/ProjectWorkflow';
import { API_URL } from '../config/api';
import { useDialog } from '../components/ui/Dialog';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { ImportSubProjectsModal } from '../components/ImportSubProjectsModal';
import { ExportSubProjectsModal } from '../components/ExportSubProjectsModal';
import { EditSubProjectModal } from '../components/EditSubProjectModal';

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
    children?: SubProject[]; // Nested children
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
    description: string;
    attachment?: string;
    attachments?: ProjectAttachmentType[];
    progress: number;
    status: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED';
    priority?: 'NORMAL' | 'HIGH';
    parentId?: number;
    parent?: { id: number, name: string, code: string };
    children?: SubProject[];
    workflow?: WorkflowData;
    // Sub-project specific fields
    documentNumber?: string;
    documentDate?: string;
    implementingUnit?: string;
    appraisalUnit?: string;
    approver?: string;
    productType?: string;
}

const ProjectDetails = () => {
    const { id } = useParams();
    const { token, user } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'workflow' | 'discussion' | 'activity'>('info');
    const [approving, setApproving] = useState(false);
    const [showCreateChildModal, setShowCreateChildModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSubProject, setEditingSubProject] = useState<any>(null);
    const [users, setUsers] = useState<{ id: number; name: string; role: string }[]>([]);
    const [subProjectPage, setSubProjectPage] = useState(1);
    const SUBPROJECTS_PER_PAGE = 10;
    const { showConfirm, showSuccess, showError } = useDialog();

    const fetchProject = useCallback(async () => {
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
    }, [id, token]);

    useEffect(() => {
        if (token && id) fetchProject();
    }, [token, id, fetchProject]);

    // Fetch users for import modal
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch(`${API_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setUsers(data);
                    }
                }
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };
        if (token) fetchUsers();
    }, [token]);

    // Auto-confirm "Đã nhận thông tin" khi người thực hiện xem dự án
    useEffect(() => {
        const autoConfirmReceived = async () => {
            if (!project || !token || !user) return;

            // Chỉ confirm nếu:
            // 1. Người xem là implementer hoặc cooperator
            // 2. Workflow chưa được confirm received
            const isImplementer = project.implementers?.some(imp => imp.id === user.id) || false;
            const isCooperator = project.cooperators?.some(coop => coop.id === user.id) || false;
            const workflow = project.workflow;

            if ((isImplementer || isCooperator) && workflow && !workflow.receivedConfirmedAt) {
                try {
                    const response = await fetch(`${API_URL}/projects/${project.id}/workflow/confirm-received`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        console.log('[ProjectDetails] Auto-confirmed "Đã nhận thông tin" for implementer');
                        // Refresh project to get updated workflow
                        fetchProject();
                    }
                } catch (error) {
                    console.error('Error auto-confirming received:', error);
                }
            }
        };

        autoConfirmReceived();
    }, [project?.id, project?.workflow?.receivedConfirmedAt, user?.id]); // Only run when project is loaded

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
                bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
                text: 'Hoàn thành',
                icon: CheckCircle2
            },
            'PENDING_APPROVAL': {
                bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
                text: 'Chờ duyệt',
                icon: Target
            },
            'IN_PROGRESS': {
                bg: 'bg-gradient-to-r from-blue-500 to-indigo-500',
                text: 'Đang thực hiện',
                icon: Loader2
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
                        to="/projects"
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
    const isImplementer = project.implementers?.some(imp => imp.id === user?.id) || false;
    const isCooperator = project.cooperators?.some(coop => coop.id === user?.id) || false;
    const isFollower = project.followers?.some(fol => fol.id === user?.id) || false;
    const canEditSubProject = isManager || isImplementer || isCooperator;
    const canApprove = (isManager || isFollower) && project.status === 'PENDING_APPROVAL';
    const isAdmin = user?.role === 'ADMIN';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <Link
                                to={project.parentId ? `/projects/${project.parentId}` : "/projects"}
                                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm"
                                title={project.parentId ? "Quay về dự án cha" : "Quay về danh sách dự án"}
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
                            {canApprove && (
                                <button
                                    onClick={handleApprove}
                                    disabled={approving}
                                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/30 disabled:opacity-50 flex items-center gap-2 transition-all duration-200"
                                >
                                    {approving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                    {approving ? 'Đang duyệt...' : 'Duyệt hoàn thành'}
                                </button>
                            )}
                        </div>
                    </div>


                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Modern Tabs */}
                <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-1.5">
                    <div className="flex gap-1.5">
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
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
                            {/* Quick Stats - Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 group hover:shadow-md transition-shadow col-span-2 md:col-span-1">
                                    <div className={`p-3 rounded-xl w-fit mb-3 ${project.priority === 'HIGH' ? 'bg-red-50' : 'bg-gray-50'}`}>
                                        <Flag size={20} className={project.priority === 'HIGH' ? 'text-red-500' : 'text-gray-500'} />
                                    </div>
                                    <p className="text-xs text-gray-500 font-medium mb-0.5">Mức độ ưu tiên</p>
                                    <p className={`font-bold ${project.priority === 'HIGH' ? 'text-red-600' : 'text-gray-900'}`}>
                                        {project.priority === 'HIGH' ? 'Ưu tiên cao' : 'Bình thường'}
                                    </p>
                                </div>
                            </div>

                            {/* Description Card */}
                            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                                    <h3 className="font-semibold text-white flex items-center gap-2">
                                        <FileText size={18} />
                                        Mô tả dự án
                                    </h3>
                                </div>
                                <div className="p-6 text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {project.description || (
                                        <span className="text-gray-400 italic">Chưa có mô tả cho dự án này.</span>
                                    )}
                                </div>
                            </div>

                            {/* Details Grid - Only show if values exist */}
                            {(project.group || project.value) && (
                                <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6">
                                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <Briefcase size={18} className="text-indigo-600" />
                                        Thông tin chi tiết
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {project.group && (
                                            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                                                <p className="text-xs text-blue-600 font-semibold mb-1 uppercase tracking-wide">Nhóm dự án</p>
                                                <p className="font-bold text-gray-900">{project.group}</p>
                                            </div>
                                        )}
                                        {project.value && (
                                            <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                                                <p className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wide">Giá trị</p>
                                                <p className="font-bold text-gray-900">{project.value}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Sub-project Specific Info - Only show for sub-projects */}
                            {project.parentId && (
                                <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6">
                                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <FileText size={18} className="text-cyan-600" />
                                        Thông tin văn bản
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-100">
                                            <p className="text-xs text-cyan-600 font-semibold mb-1 uppercase tracking-wide">Số hiệu văn bản</p>
                                            <p className={`font-bold ${project.documentNumber ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                                {project.documentNumber || 'Chưa có thông tin'}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                                            <p className="text-xs text-amber-600 font-semibold mb-1 uppercase tracking-wide">Ngày văn bản</p>
                                            <p className={`font-bold ${project.documentDate ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                                {project.documentDate ? new Date(project.documentDate).toLocaleDateString('vi-VN') : 'Chưa có thông tin'}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
                                            <p className="text-xs text-violet-600 font-semibold mb-1 uppercase tracking-wide">Đơn vị thực hiện</p>
                                            <p className={`font-bold ${project.implementingUnit ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                                {project.implementingUnit || 'Chưa có thông tin'}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border border-pink-100">
                                            <p className="text-xs text-pink-600 font-semibold mb-1 uppercase tracking-wide">Đơn vị thẩm định</p>
                                            <p className={`font-bold ${project.appraisalUnit ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                                {project.appraisalUnit || 'Chưa có thông tin'}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl border border-teal-100">
                                            <p className="text-xs text-teal-600 font-semibold mb-1 uppercase tracking-wide">Người phê duyệt</p>
                                            <p className={`font-bold ${project.approver ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                                {project.approver || 'Chưa có thông tin'}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
                                            <p className="text-xs text-indigo-600 font-semibold mb-1 uppercase tracking-wide">Loại sản phẩm</p>
                                            <p className={`font-bold ${project.productType ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                                {project.productType || 'Chưa có thông tin'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Project Attachments */}
                            <ProjectAttachments
                                projectId={project.id}
                                projectName={project.name}
                                projectStatus={project.status}
                                canUpload={isImplementer || isManager || isCooperator}
                                isImplementer={isImplementer}
                                isCooperator={isCooperator}
                                isAdmin={false}
                                isManager={isManager}
                                attachments={project.attachments}
                                onRefresh={fetchProject}
                            />
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Team Members */}
                            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden">
                                <div className="px-5 py-4 bg-gradient-to-r from-violet-600 to-purple-600">
                                    <h3 className="font-semibold text-white flex items-center gap-2">
                                        <Users size={18} />
                                        Thành viên dự án
                                    </h3>
                                </div>
                                <div className="p-5">
                                    {/* Manager */}
                                    <div className="mb-5">
                                        <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">Quản trị dự án</p>
                                        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl">
                                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/30">
                                                {project.manager?.name?.charAt(0) || '?'}
                                            </div>
                                            <span className="font-semibold text-gray-900">{project.manager?.name || 'Chưa gán'}</span>
                                        </div>
                                    </div>

                                    {/* Implementers */}
                                    <div className="mb-5">
                                        <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">
                                            Người thực hiện ({project.implementers?.length || 0})
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {project.implementers?.map(u => (
                                                <span
                                                    key={u.id}
                                                    className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 text-sm font-medium rounded-full"
                                                >
                                                    {u.name}
                                                </span>
                                            ))}
                                            {(!project.implementers || project.implementers.length === 0) && (
                                                <span className="text-gray-400 text-sm italic">Chưa có</span>
                                            )}
                                        </div>
                                    </div>



                                    {/* Cooperators */}
                                    {project.cooperators && project.cooperators.length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">
                                                Phối hợp ({project.cooperators.length})
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {project.cooperators.map(u => (
                                                    <span
                                                        key={u.id}
                                                        className="px-3 py-1.5 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 text-sm font-medium rounded-full"
                                                    >
                                                        {u.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Sub Projects Section - Always visible for non-child projects */}
                            {!project.parentId && (
                                <div className="bg-white rounded-2xl p-5 shadow-lg shadow-gray-100 border border-gray-100">
                                    {/* Header */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl text-white">
                                            <FolderTree size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900">Dự án con</h2>
                                            <p className="text-sm text-gray-500">{project.children?.length || 0} dự án</p>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    {(isManager || isAdmin) && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {project.children && project.children.length > 0 && (
                                                <button
                                                    onClick={() => setShowExportModal(true)}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-all"
                                                    title="Xuất ra Excel"
                                                >
                                                    <Download size={14} />
                                                    Export
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setShowImportModal(true)}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all"
                                                title="Import từ Excel"
                                            >
                                                <FileSpreadsheet size={14} />
                                                Import
                                            </button>
                                            <button
                                                onClick={() => setShowCreateChildModal(true)}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white text-xs font-medium rounded-lg transition-all"
                                            >
                                                <Plus size={14} />
                                                Thêm
                                            </button>
                                        </div>
                                    )}

                                    {/* Sub Projects List */}
                                    {project.children && project.children.length > 0 ? (
                                        <div className="space-y-2">
                                            {(() => {
                                                const totalChildren = project.children?.length || 0;
                                                const totalPages = Math.ceil(totalChildren / SUBPROJECTS_PER_PAGE);
                                                const startIndex = (subProjectPage - 1) * SUBPROJECTS_PER_PAGE;
                                                const endIndex = startIndex + SUBPROJECTS_PER_PAGE;
                                                const paginatedChildren = project.children?.slice(startIndex, endIndex) || [];

                                                return (
                                                    <>
                                                        {paginatedChildren.map(child => (
                                                            <div
                                                                key={child.id}
                                                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors group border border-transparent hover:border-blue-200"
                                                            >
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${child.status === 'COMPLETED' ? 'bg-green-500' :
                                                                    child.status === 'PENDING_APPROVAL' ? 'bg-orange-500' : 'bg-blue-500'
                                                                    }`}>
                                                                    <FolderTree size={14} />
                                                                </div>
                                                                <Link to={`/projects/${child.id}`} className="flex-1 min-w-0">
                                                                    <p className="font-medium text-sm text-gray-900 truncate group-hover:text-blue-600">
                                                                        {child.name}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-xs text-gray-500">{child.code}</span>
                                                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${child.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                                            child.status === 'PENDING_APPROVAL' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                                            }`}>
                                                                            {child.progress}%
                                                                        </span>
                                                                    </div>
                                                                </Link>
                                                                {/* Edit Button */}
                                                                {canEditSubProject && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setEditingSubProject(child);
                                                                            setShowEditModal(true);
                                                                        }}
                                                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-100 active:bg-blue-200 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100"
                                                                        title="Chỉnh sửa"
                                                                    >
                                                                        <Edit3 size={16} />
                                                                    </button>
                                                                )}
                                                                <Link
                                                                    to={`/projects/${child.id}`}
                                                                    className="flex-shrink-0"
                                                                >
                                                                    <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500" />
                                                                </Link>
                                                            </div>
                                                        ))}

                                                        {/* Pagination Controls */}
                                                        {totalPages > 1 && (
                                                            <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                                                                <span className="text-xs text-gray-500">
                                                                    {startIndex + 1} - {Math.min(endIndex, totalChildren)} / {totalChildren} dự án con
                                                                </span>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => setSubProjectPage(p => Math.max(1, p - 1))}
                                                                        disabled={subProjectPage === 1}
                                                                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                    >
                                                                        <ChevronLeft size={16} />
                                                                    </button>
                                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                                        <button
                                                                            key={page}
                                                                            onClick={() => setSubProjectPage(page)}
                                                                            className={`min-w-[36px] h-9 text-xs font-medium rounded-lg transition-colors ${subProjectPage === page
                                                                                ? 'bg-blue-600 text-white'
                                                                                : 'border border-gray-200 hover:bg-gray-100 text-gray-600'
                                                                                }`}
                                                                        >
                                                                            {page}
                                                                        </button>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => setSubProjectPage(p => Math.min(totalPages, p + 1))}
                                                                        disabled={subProjectPage === totalPages}
                                                                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                    >
                                                                        <ChevronRight size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <FolderTree size={40} className="mx-auto text-gray-300 mb-3" />
                                            <p className="text-gray-500 text-sm">Chưa có dự án con</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Parent Project */}
                            {project.parent && (
                                <div className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-100 border border-gray-100">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
                                            <FolderTree size={20} />
                                        </div>
                                        <h2 className="text-lg font-bold text-gray-900">Dự án cha</h2>
                                    </div>
                                    <Link
                                        to={`/projects/${project.parent.id}`}
                                        className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl hover:from-indigo-100 hover:to-purple-100 transition-colors group"
                                    >
                                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
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


                        </div>
                    </div>
                )}

                {activeTab === 'workflow' && (
                    <ProjectWorkflow
                        projectId={project.id}
                        workflow={project.workflow || null}
                        isManager={isManager}
                        isImplementer={isImplementer}
                        isAdmin={false}
                        token={token || ''}
                        onRefresh={fetchProject}
                    />
                )}

                {activeTab === 'discussion' && (
                    <div className="bg-white rounded-2xl shadow-lg shadow-gray-100 overflow-hidden border border-gray-100">
                        <DiscussionPanel projectId={project.id} />
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="bg-white rounded-2xl shadow-lg shadow-gray-100 overflow-hidden border border-gray-100">
                        <ActivityHistoryPanel projectId={project.id} />
                    </div>
                )}
            </div>




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

            {/* Create Child Project Modal */}
            <CreateProjectModal
                isOpen={showCreateChildModal}
                onClose={() => setShowCreateChildModal(false)}
                onSuccess={() => {
                    setShowCreateChildModal(false);
                    fetchProject();
                }}
                parentId={project.id}
            />

            {/* Import Sub Projects Modal */}
            <ImportSubProjectsModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                parentProjectId={project.id}
                parentProjectCode={project.code}
                onImportSuccess={() => {
                    fetchProject();
                }}
                users={users}
            />

            {/* Export Sub Projects Modal */}
            <ExportSubProjectsModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                parentProjectCode={project.code}
                parentProjectName={project.name}
                subProjects={project.children || []}
            />

            {/* Edit Sub Project Modal */}
            <EditSubProjectModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingSubProject(null);
                }}
                onSuccess={fetchProject}
                subProject={editingSubProject}
                users={users}
            />

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

export default ProjectDetails;
