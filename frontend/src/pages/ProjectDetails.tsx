import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar, User, Users, Eye, Clock, X, FileText, Image as ImageIcon, MessageSquare, History, CheckCircle2 } from 'lucide-react';
import { DiscussionPanel } from '../components/DiscussionPanel';
import { ActivityHistoryPanel } from '../components/ActivityHistoryPanel';
import { OnlyOfficeViewer } from '../components/OnlyOfficeViewer';
import { API_URL } from '../config/api';
import { getDisplayFilename } from '../utils/filenameUtils';

// Office file extensions supported by OnlyOffice
const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'csv', 'rtf'];
const isOfficeFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return officeExtensions.includes(ext);
};

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
}

const ProjectDetails = () => {
    const { id } = useParams();
    const { token, user } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'discussion' | 'activity'>('info');
    const [showOnlyOffice, setShowOnlyOffice] = useState(false);
    const [approving, setApproving] = useState(false);

    const cleanupImageUrl = useCallback(() => {
        if (imageUrl) {
            URL.revokeObjectURL(imageUrl);
        }
    }, [imageUrl]);

    useEffect(() => {
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

        if (token && id) fetchProject();

        // Cleanup blob URL on unmount
        return () => {
            cleanupImageUrl();
        };
    }, [token, id, cleanupImageUrl]);

    if (loading) return <div className="p-6">Loading...</div>;
    if (!project) return <div className="p-6">Project not found</div>;

    const isImage = project.attachment && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(project.attachment.split('.').pop()?.toLowerCase() || '');

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link to="/projects" className="p-2 hover:bg-white rounded-lg text-gray-600 transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                        <p className="text-gray-500 text-sm mt-1">Mã dự án: <span className="font-medium text-gray-700">{project.code}</span></p>
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
                    <div className="space-y-6">
                        {/* First Row: Progress + Timeline + Members */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Progress Section */}
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">Tiến độ thực hiện</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Hiện tại:</span>
                                            <span className={`text-2xl font-bold ${
                                                project.status === 'COMPLETED' ? 'text-green-600' :
                                                project.status === 'PENDING_APPROVAL' ? 'text-orange-600' :
                                                'text-blue-600'
                                            }`}>{project.progress || 0}%</span>
                                        </div>

                                        {/* Progress Bar Display */}
                                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    project.status === 'COMPLETED' ? 'bg-green-500' :
                                                    project.status === 'PENDING_APPROVAL' ? 'bg-orange-500' :
                                                    'bg-blue-500'
                                                }`}
                                                style={{ width: `${project.progress || 0}%` }}
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
                                                value={project.progress || 0}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onInput={(e) => {
                                                    const target = e.target as HTMLInputElement;
                                                    const newProgress = Number(target.value);
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
                                                        ? `linear-gradient(to right, #10b981 0%, #10b981 ${project.progress || 0}%, #e5e7eb ${project.progress || 0}%, #e5e7eb 100%)`
                                                        : project.status === 'PENDING_APPROVAL'
                                                            ? `linear-gradient(to right, #f97316 0%, #f97316 ${project.progress || 0}%, #e5e7eb ${project.progress || 0}%, #e5e7eb 100%)`
                                                            : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${project.progress || 0}%, #e5e7eb ${project.progress || 0}%, #e5e7eb 100%)`
                                                }}
                                            />
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>0%</span>
                                                <span>50%</span>
                                                <span>100%</span>
                                            </div>
                                        </div>

                                        {/* Status Message */}
                                        {project.status === 'PENDING_APPROVAL' && (
                                            <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg mt-2">
                                                <p className="text-xs text-orange-800 font-medium text-center">
                                                    ⏳ Dự án đang chờ duyệt
                                                </p>
                                                {(project.manager?.id === user?.id || project.followers?.some(f => f.id === user?.id)) && (
                                                    <button
                                                        onClick={async () => {
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
                                                                    alert('Dự án đã được duyệt thành công!');
                                                                } else {
                                                                    const error = await response.json();
                                                                    alert(error.message || 'Không thể duyệt dự án');
                                                                }
                                                            } catch (error) {
                                                                console.error('Error approving project:', error);
                                                                alert('Có lỗi xảy ra khi duyệt dự án');
                                                            } finally {
                                                                setApproving(false);
                                                            }
                                                        }}
                                                        disabled={approving}
                                                        className="w-full mt-2 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                                    >
                                                        <CheckCircle2 size={14} />
                                                        {approving ? 'Đang duyệt...' : 'Duyệt dự án'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {project.status === 'COMPLETED' && (
                                            <div className="p-2 bg-green-50 border border-green-200 rounded-lg mt-2">
                                                <p className="text-xs text-green-800 font-medium text-center">
                                                    ✅ Dự án đã hoàn thành
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Timeline Section */}
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">Thời gian</h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                                            <div className="p-1.5 bg-blue-600 text-white rounded">
                                                <Calendar size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-blue-700 font-medium">Ngày bắt đầu</p>
                                                <p className="font-semibold text-gray-900 text-sm">
                                                    {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                                            <div className="p-1.5 bg-red-500 text-white rounded">
                                                <Clock size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-red-600 font-medium">Ngày kết thúc</p>
                                                <p className="font-semibold text-gray-900 text-sm">
                                                    {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                                            <div className="p-1.5 bg-purple-600 text-white rounded">
                                                <Clock size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-purple-600 font-medium">Thời lượng</p>
                                                <p className="font-semibold text-gray-900 text-sm">{project.duration || 'N/A'} ngày</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Members Section */}
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">Thành viên</h3>
                                    <div className="space-y-3">
                                        {/* Manager */}
                                        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                                            <div className="p-1.5 bg-purple-600 text-white rounded">
                                                <User size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-purple-700 font-medium">Quản trị dự án</p>
                                                <p className="font-semibold text-gray-900 text-sm">{project.manager?.name || 'Chưa gán'}</p>
                                            </div>
                                        </div>

                                        {/* Implementers */}
                                        <div className="pt-2 border-t border-gray-100">
                                            <div className="flex items-center gap-1 mb-2">
                                                <Users size={12} className="text-gray-500" />
                                                <span className="text-xs font-semibold text-gray-700">
                                                    Người thực hiện ({project.implementers?.length || 0})
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {project.implementers?.length > 0 ? project.implementers.map(u => (
                                                    <span key={u.id} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                        {u.name}
                                                    </span>
                                                )) : <span className="text-gray-400 text-xs">Chưa có</span>}
                                            </div>
                                        </div>

                                        {/* Followers */}
                                        <div className="pt-2 border-t border-gray-100">
                                            <div className="flex items-center gap-1 mb-2">
                                                <Eye size={12} className="text-gray-500" />
                                                <span className="text-xs font-semibold text-gray-700">
                                                    Người theo dõi ({project.followers?.length || 0})
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {project.followers?.length > 0 ? project.followers.map(u => (
                                                    <span key={u.id} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                                        {u.name}
                                                    </span>
                                                )) : <span className="text-gray-400 text-xs">Chưa có</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Second Row: Description */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <FileText size={16} className="text-blue-600" />
                                Mô tả dự án
                            </h2>
                            <div className="text-sm text-gray-700 leading-relaxed">
                                {project.description || 'Chưa có mô tả.'}
                            </div>
                        </div>

                        {/* Third Row: Details + Attachment */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Details */}
                            <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-base font-bold text-gray-900 mb-3">Thông tin chi tiết</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                                        <p className="text-xs text-blue-600 font-medium mb-1">Nhóm dự án</p>
                                        <p className="font-semibold text-gray-900 text-sm">{project.group || 'N/A'}</p>
                                    </div>
                                    <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                                        <p className="text-xs text-green-600 font-medium mb-1">Giá trị</p>
                                        <p className="font-semibold text-gray-900 text-sm">{project.value || 'N/A'}</p>
                                    </div>
                                    <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 col-span-2">
                                        <p className="text-xs text-purple-600 font-medium mb-1">Phương thức tiến độ</p>
                                        <p className="font-semibold text-gray-900 text-sm">{project.progressMethod || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Attachment */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <ImageIcon size={16} className="text-red-600" />
                                    Tài liệu đính kèm
                                </h2>
                                {project.attachment ? (
                                    <div
                                        onClick={async () => {
                                            const ext = project.attachment?.split('.').pop()?.toLowerCase() || '';
                                            const isImageFile = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                                            const isOffice = isOfficeFile(project.attachment || '');
                                            
                                            if (isImageFile) {
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
                                                setShowOnlyOffice(true);
                                            } else {
                                                window.open(`${API_URL}/projects/${project.id}/attachment`, '_blank');
                                            }
                                        }}
                                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all group"
                                    >
                                        <div className="p-2 bg-white rounded-lg border border-gray-200 group-hover:border-blue-400">
                                            {isImage ? (
                                                <ImageIcon size={20} className="text-blue-600" />
                                            ) : isOfficeFile(project.attachment || '') ? (
                                                <FileText size={20} className="text-green-600" />
                                            ) : (
                                                <FileText size={20} className="text-gray-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-900 truncate group-hover:text-blue-600">
                                                {getDisplayFilename(project.attachment)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {isImage ? 'Ảnh' : isOfficeFile(project.attachment || '') ? 'Click để xem với OnlyOffice' : 'File'}
                                            </p>
                                        </div>
                                        <button className={`px-3 py-1 text-white text-xs font-medium rounded ${
                                            isOfficeFile(project.attachment || '') 
                                                ? 'bg-green-600' 
                                                : 'bg-blue-600'
                                        }`}>
                                            Mở
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                        <p className="text-gray-500 text-xs">Không có tài liệu đính kèm</p>
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
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
                    <button
                        className="absolute top-4 right-4 text-white hover:text-gray-300 p-3 bg-black/50 rounded-full hover:bg-black/70 transition-all"
                        onClick={() => setPreviewImage(null)}
                        title="Đóng"
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
    );
};

export default ProjectDetails;
