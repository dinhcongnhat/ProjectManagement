import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { ArrowLeft, Calendar, User, Users, Eye, Clock, CheckCircle2, AlertCircle, FileText, Image as ImageIcon, X, MessageSquare, History, FolderTree, Plus, ChevronRight } from 'lucide-react';
import { DiscussionPanel } from '../../components/DiscussionPanel';
import { ActivityHistoryPanel } from '../../components/ActivityHistoryPanel';
import { OnlyOfficeViewer } from '../../components/OnlyOfficeViewer';
import { getDisplayFilename } from '../../utils/filenameUtils';

// Office file extensions supported by OnlyOffice
const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'csv', 'rtf'];
const isOfficeFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return officeExtensions.includes(ext);
};

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
    attachment?: string;
    progress: number;
    status: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED';
    parentId?: number;
    parent?: { id: number, name: string, code: string };
    children?: SubProject[];
}

const ProjectDetailsAdmin = () => {
    const { id } = useParams();
    const { token } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'discussion' | 'activity'>('info');
    const [showOnlyOffice, setShowOnlyOffice] = useState(false);

    const fetchProject = async () => {
        try {
            const response = await fetch(`${API_URL}/projects/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setProject(data);
                // Don't load attachment immediately for better performance
            }
        } catch (error) {
            console.error('Error fetching project:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token && id) fetchProject();

        // Cleanup blob URL on unmount
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [token, id]);

    const handleApprove = async () => {
        if (!project) return;

        if (!confirm('Bạn có chắc chắn muốn duyệt và hoàn thành dự án này?')) return;

        setApproving(true);
        try {
            const response = await fetch(`${API_URL}/projects/${project.id}/approve`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const updatedProject = await response.json();
                setProject(updatedProject);
                alert('Dự án đã được duyệt và chuyển sang trạng thái hoàn thành!');
            } else {
                alert('Không thể duyệt dự án');
            }
        } catch (error) {
            console.error('Error approving project:', error);
            alert('Có lỗi xảy ra khi duyệt dự án');
        } finally {
            setApproving(false);
        }
    };

    const getStatusBadge = (status: string, progress: number) => {
        switch (status) {
            case 'COMPLETED':
                return (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                        <CheckCircle2 size={20} />
                        <span>Hoàn thành ({progress}%)</span>
                    </div>
                );
            case 'PENDING_APPROVAL':
                return (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg font-medium">
                        <Clock size={20} />
                        <span>Chờ duyệt ({progress}%)</span>
                    </div>
                );
            default:
                return (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium">
                        <AlertCircle size={20} />
                        <span>Đang thực hiện ({progress}%)</span>
                    </div>
                );
        }
    };

    if (loading) return <div className="p-6">Loading...</div>;
    if (!project) return <div className="p-6">Project not found</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/admin/projects" className="p-2 hover:bg-white rounded-lg text-gray-600 transition-colors">
                            <ArrowLeft size={24} />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                            <p className="text-gray-500 text-sm mt-1">Mã dự án: <span className="font-medium text-gray-700">{project.code}</span></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {getStatusBadge(project.status, project.progress)}
                        {project.status === 'PENDING_APPROVAL' && (
                            <button
                                onClick={handleApprove}
                                disabled={approving}
                                className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <CheckCircle2 size={20} />
                                {approving ? 'Đang duyệt...' : 'Duyệt dự án'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'info'
                                ? 'text-red-600 border-b-2 border-red-600'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <FileText className="inline-block mr-2" size={18} />
                            Thông tin dự án
                        </button>
                        <button
                            onClick={() => setActiveTab('discussion')}
                            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'discussion'
                                ? 'text-red-600 border-b-2 border-red-600'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <MessageSquare className="inline-block mr-2" size={18} />
                            Thảo luận
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'activity'
                                ? 'text-red-600 border-b-2 border-red-600'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <History className="inline-block mr-2" size={18} />
                            Lịch sử hoạt động
                        </button>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'info' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Progress and Timeline Combined */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Progress Section - Compact */}
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-3">Tiến độ thực hiện</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Hiện tại:</span>
                                                <span className="text-2xl font-bold text-blue-600">{project.progress}%</span>
                                            </div>

                                            {/* Progress Bar Display */}
                                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${project.status === 'COMPLETED' ? 'bg-green-500' :
                                                        project.status === 'PENDING_APPROVAL' ? 'bg-orange-500' :
                                                            'bg-blue-500'
                                                        }`}
                                                    style={{ width: `${project.progress}%` }}
                                                ></div>
                                            </div>

                                            {/* Interactive Slider */}
                                            <div className="relative pt-1">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    title="Kéo để điều chỉnh tiến độ"
                                                    value={project.progress}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onInput={async (e) => {
                                                        const target = e.target as HTMLInputElement;
                                                        const newProgress = Number(target.value);
                                                        // Update UI immediately
                                                        setProject(prev => prev ? { ...prev, progress: newProgress } : prev);
                                                    }}
                                                    onMouseUp={async (e) => {
                                                        const target = e.target as HTMLInputElement;
                                                        const newProgress = Number(target.value);
                                                        try {
                                                            const response = await fetch(`${API_URL}/projects/${project.id}/progress`, {
                                                                method: 'PATCH',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    Authorization: `Bearer ${token}`,
                                                                },
                                                                body: JSON.stringify({ progress: newProgress }),
                                                            });
                                                            if (response.ok) {
                                                                const updatedProject = await response.json();
                                                                setProject(updatedProject);
                                                            }
                                                        } catch (error) {
                                                            console.error('Error updating progress:', error);
                                                        }
                                                    }}
                                                    onTouchEnd={async (e) => {
                                                        const target = e.target as HTMLInputElement;
                                                        const newProgress = Number(target.value);
                                                        try {
                                                            const response = await fetch(`${API_URL}/projects/${project.id}/progress`, {
                                                                method: 'PATCH',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    Authorization: `Bearer ${token}`,
                                                                },
                                                                body: JSON.stringify({ progress: newProgress }),
                                                            });
                                                            if (response.ok) {
                                                                const updatedProject = await response.json();
                                                                setProject(updatedProject);
                                                            }
                                                        } catch (error) {
                                                            console.error('Error updating progress:', error);
                                                        }
                                                    }}
                                                    disabled={project.status === 'COMPLETED'}
                                                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 ${
                                                        project.status === 'COMPLETED' ? 'opacity-50 cursor-not-allowed' : ''
                                                    }`}
                                                    style={{
                                                        background: project.status === 'COMPLETED'
                                                            ? `linear-gradient(to right, #10b981 0%, #10b981 ${project.progress}%, #e5e7eb ${project.progress}%, #e5e7eb 100%)`
                                                            : project.status === 'PENDING_APPROVAL'
                                                                ? `linear-gradient(to right, #f97316 0%, #f97316 ${project.progress}%, #e5e7eb ${project.progress}%, #e5e7eb 100%)`
                                                                : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${project.progress}%, #e5e7eb ${project.progress}%, #e5e7eb 100%)`
                                                    }}
                                                />
                                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                    <span>0%</span>
                                                    <span>50%</span>
                                                    <span>100%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Message */}
                                        {project.status === 'PENDING_APPROVAL' && (
                                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mt-3">
                                                <p className="text-sm text-orange-800 font-medium text-center">
                                                    ⏳ Dự án đang chờ duyệt
                                                </p>
                                            </div>
                                        )}
                                        {project.status === 'COMPLETED' && (
                                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-3">
                                                <p className="text-sm text-green-800 font-medium text-center">
                                                    ✅ Dự án đã được duyệt và hoàn thành
                                                </p>
                                            </div>
                                        )}
                                    </div>                                    {/* Timeline Section - Right Column */}
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-3">Thời gian</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 p-2.5 bg-blue-50 rounded-lg">
                                                <div className="p-1.5 bg-blue-600 text-white rounded">
                                                    <Calendar size={16} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-blue-700 font-medium">Ngày bắt đầu</p>
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-2.5 bg-orange-50 rounded-lg">
                                                <div className="p-1.5 bg-orange-600 text-white rounded">
                                                    <Clock size={16} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-orange-700 font-medium">Ngày kết thúc</p>
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-2.5 bg-purple-50 rounded-lg">
                                                <div className="p-1.5 bg-purple-600 text-white rounded">
                                                    <Clock size={16} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-purple-700 font-medium">Thời lượng</p>
                                                    <p className="text-sm font-semibold text-gray-900">{project.duration || 'N/A'} ngày</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                                    <FileText size={16} className="text-blue-600" />
                                    Mô tả dự án
                                </h2>
                                <div className="text-sm text-gray-700 leading-relaxed">
                                    {project.description || 'Chưa có mô tả.'}
                                </div>
                            </div>

                            {/* Details Grid - Compact */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Thông tin chi tiết</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                                        <p className="text-xs text-blue-700 mb-1 font-medium">Nhóm dự án</p>
                                        <p className="text-sm font-semibold text-gray-900">{project.group || 'N/A'}</p>
                                    </div>
                                    <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                                        <p className="text-xs text-green-700 mb-1 font-medium">Giá trị</p>
                                        <p className="text-sm font-semibold text-gray-900">{project.value || 'N/A'}</p>
                                    </div>
                                    <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg col-span-2">
                                        <p className="text-xs text-purple-700 mb-1 font-medium">Phương thức tiến độ</p>
                                        <p className="text-sm font-semibold text-gray-900">{project.progressMethod || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Attachment */}
                            {project.attachment && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <ImageIcon size={18} className="text-red-600" />
                                        Tài liệu đính kèm
                                    </h2>
                                    <div
                                        onClick={async () => {
                                            const ext = project.attachment?.split('.').pop()?.toLowerCase() || '';
                                            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                                            const isOffice = isOfficeFile(project.attachment || '');
                                            
                                            if (isImage) {
                                                // Lazy load image when user clicks
                                                if (!imageUrl) {
                                                    const imgResponse = await fetch(`${API_URL}/projects/${project.id}/attachment`, {
                                                        headers: { Authorization: `Bearer ${token}` },
                                                    });
                                                    if (imgResponse.ok) {
                                                        const blob = await imgResponse.blob();
                                                        const url = URL.createObjectURL(blob);
                                                        setImageUrl(url);
                                                        setPreviewImage(url);
                                                    }
                                                } else {
                                                    setPreviewImage(imageUrl);
                                                }
                                            } else if (isOffice) {
                                                // Open with OnlyOffice
                                                setShowOnlyOffice(true);
                                            } else {
                                                // Download other files
                                                window.open(`${API_URL}/projects/${project.id}/attachment`, '_blank');
                                            }
                                        }}
                                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border-2 border-gray-200 hover:border-blue-400 cursor-pointer transition-all hover:shadow-md group"
                                    >
                                        <div className="p-3 bg-white rounded-lg border border-gray-200 group-hover:border-blue-400 transition-colors">
                                            {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(project.attachment?.split('.').pop()?.toLowerCase() || '') ? (
                                                <ImageIcon size={28} className="text-blue-600" />
                                            ) : isOfficeFile(project.attachment || '') ? (
                                                <FileText size={28} className="text-green-600" />
                                            ) : (
                                                <FileText size={28} className="text-red-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                                {getDisplayFilename(project.attachment)}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(project.attachment?.split('.').pop()?.toLowerCase() || '') 
                                                    ? 'Click để xem ảnh' 
                                                    : isOfficeFile(project.attachment || '')
                                                        ? 'Click để xem với OnlyOffice'
                                                        : 'Click để tải xuống'}
                                            </p>
                                        </div>
                                        <div className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                                            isOfficeFile(project.attachment || '') 
                                                ? 'bg-green-600 group-hover:bg-green-700' 
                                                : 'bg-blue-600 group-hover:bg-blue-700'
                                        }`}>
                                            {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(project.attachment?.split('.').pop()?.toLowerCase() || '') 
                                                ? '👁️ Xem' 
                                                : isOfficeFile(project.attachment || '')
                                                    ? '📄 Mở'
                                                    : '⬇️ Tải'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Team Members */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Thành viên</h2>
                                <div className="space-y-4">
                                    {/* Manager */}
                                    <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                                        <div className="p-2 bg-purple-600 text-white rounded-lg">
                                            <User size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-purple-700 font-medium">Quản trị dự án</p>
                                            <p className="font-semibold text-gray-900 text-sm">{project.manager?.name || 'Chưa gán'}</p>
                                        </div>
                                    </div>

                                    {/* Implementers */}
                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Users size={16} className="text-gray-500" />
                                            <span className="text-sm font-semibold text-gray-700">
                                                Người thực hiện ({project.implementers?.length || 0})
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {project.implementers?.map(user => (
                                                <span key={user.id} className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 text-xs font-medium rounded-full">
                                                    {user.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Followers */}
                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Eye size={16} className="text-gray-500" />
                                            <span className="text-sm font-semibold text-gray-700">
                                                Người theo dõi ({project.followers?.length || 0})
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {project.followers?.map(user => (
                                                <span key={user.id} className="px-3 py-1.5 bg-gradient-to-r from-green-100 to-green-200 text-green-800 text-xs font-medium rounded-full">
                                                    {user.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Parent Project */}
                            {project.parent && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <FolderTree size={18} className="text-purple-600" />
                                        Dự án cha
                                    </h2>
                                    <Link 
                                        to={`/admin/projects/${project.parent.id}`}
                                        className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors group"
                                    >
                                        <div className="p-2 bg-purple-600 text-white rounded-lg">
                                            <FolderTree size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-purple-600">
                                                {project.parent.name}
                                            </p>
                                            <p className="text-xs text-gray-500">Mã: {project.parent.code}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-600" />
                                    </Link>
                                </div>
                            )}

                            {/* Sub Projects */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <FolderTree size={18} className="text-blue-600" />
                                        Dự án con ({project.children?.length || 0})
                                    </h2>
                                    <Link
                                        to={`/admin/projects/create?parentId=${project.id}`}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
                                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors group border border-transparent hover:border-blue-200"
                                            >
                                                <div className={`p-2 rounded-lg text-white ${
                                                    child.status === 'COMPLETED' ? 'bg-green-500' :
                                                    child.status === 'PENDING_APPROVAL' ? 'bg-orange-500' : 'bg-blue-500'
                                                }`}>
                                                    <FolderTree size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600">
                                                        {child.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-500">{child.code}</span>
                                                        <span className="text-xs text-gray-400">•</span>
                                                        <span className={`text-xs font-medium ${
                                                            child.status === 'COMPLETED' ? 'text-green-600' :
                                                            child.status === 'PENDING_APPROVAL' ? 'text-orange-600' : 'text-blue-600'
                                                        }`}>
                                                            {child.progress}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${
                                                                child.status === 'COMPLETED' ? 'bg-green-500' :
                                                                child.status === 'PENDING_APPROVAL' ? 'bg-orange-500' : 'bg-blue-500'
                                                            }`}
                                                            style={{ width: `${child.progress}%` }}
                                                        />
                                                    </div>
                                                    <ChevronRight size={14} className="text-gray-400 group-hover:text-blue-600" />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-500">
                                        <FolderTree size={32} className="mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm">Chưa có dự án con</p>
                                        <p className="text-xs text-gray-400 mt-1">Nhấn "Thêm" để tạo dự án con</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Discussion Tab */}
                {activeTab === 'discussion' && project && (
                    <DiscussionPanel projectId={project.id} />
                )}

                {/* Activity History Tab */}
                {activeTab === 'activity' && project && (
                    <ActivityHistoryPanel projectId={project.id} />
                )}

                {/* Image Preview Modal */}
                {previewImage && (
                    <div
                        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setPreviewImage(null)}
                    >
                        <button
                            title="Đóng"
                            className="absolute top-4 right-4 text-white hover:text-gray-300 p-3 bg-black/50 rounded-full hover:bg-black/70 transition-all"
                            onClick={() => setPreviewImage(null)}
                        >
                            <X size={28} />
                        </button>
                        <img
                            src={previewImage}
                            alt="Full Preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}

                {/* OnlyOffice Viewer Modal */}
                {showOnlyOffice && project && token && (
                    <OnlyOfficeViewer
                        projectId={project.id}
                        token={token}
                        onClose={() => setShowOnlyOffice(false)}
                    />
                )}
            </div>
        </div >
    );
};

export default ProjectDetailsAdmin;
