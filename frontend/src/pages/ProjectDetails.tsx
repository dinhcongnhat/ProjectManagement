import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar, User, Users, Eye, Clock, X, FileText, Image as ImageIcon, MessageSquare, History } from 'lucide-react';
import { DiscussionPanel } from '../components/DiscussionPanel';
import { ActivityHistoryPanel } from '../components/ActivityHistoryPanel';
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
    duration: string;
    group: string;
    value: string;
    progressMethod: string;
    description: string;
    attachment?: string;
}

const ProjectDetails = () => {
    const { id } = useParams();
    const { token } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'discussion' | 'activity'>('info');

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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Content - Left Side */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Description */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <FileText size={20} className="text-blue-600" />
                                    Mô tả dự án
                                </h2>
                                <div className="prose max-w-none text-gray-700 leading-relaxed">
                                    {project.description || 'Chưa có mô tả.'}
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">Thông tin chi tiết</h2>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                                        <p className="text-sm text-blue-700 mb-1 font-medium">Nhóm dự án</p>
                                        <p className="font-semibold text-gray-900">{project.group || 'N/A'}</p>
                                    </div>
                                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                                        <p className="text-sm text-green-700 mb-1 font-medium">Giá trị</p>
                                        <p className="font-semibold text-gray-900">{project.value || 'N/A'}</p>
                                    </div>
                                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                                        <p className="text-sm text-purple-700 mb-1 font-medium">Phương thức tiến độ</p>
                                        <p className="font-semibold text-gray-900">{project.progressMethod || 'N/A'}</p>
                                    </div>
                                    <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                                        <p className="text-sm text-orange-700 mb-1 font-medium">Thời lượng</p>
                                        <p className="font-semibold text-gray-900">{project.duration || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Attachment - Moved to bottom */}
                            {project.attachment && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <ImageIcon size={20} className="text-red-600" />
                                        Tài liệu đính kèm
                                    </h2>
                                    <div
                                        onClick={async () => {
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
                                            } else {
                                                window.open(`${API_URL}/projects/${project.id}/attachment`, '_blank');
                                            }
                                        }}
                                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border-2 border-gray-200 hover:border-blue-400 cursor-pointer transition-all hover:shadow-md group"
                                    >
                                        <div className="p-3 bg-white rounded-lg border border-gray-200 group-hover:border-blue-400 transition-colors">
                                            {isImage ? (
                                                <ImageIcon size={28} className="text-blue-600" />
                                            ) : (
                                                <FileText size={28} className="text-red-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                                {project.attachment.split('-').slice(1).join('-')}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {isImage ? 'Click để xem ảnh' : 'Click để tải xuống'}
                                            </p>
                                        </div>
                                        <div className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg group-hover:bg-blue-700 transition-colors">
                                            {isImage ? '👁️ Xem' : '⬇️ Tải'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar - Right Side */}
                        <div className="space-y-6">
                            {/* Timeline */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">Thời gian</h2>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                                        <div className="p-2 bg-blue-600 text-white rounded-lg">
                                            <Calendar size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-blue-700 font-medium">Ngày bắt đầu</p>
                                            <p className="font-semibold text-gray-900 text-sm">
                                                {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                                        <div className="p-2 bg-orange-600 text-white rounded-lg">
                                            <Clock size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-orange-700 font-medium">Ngày kết thúc</p>
                                            <p className="font-semibold text-gray-900 text-sm">
                                                {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Team Members */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">Thành viên</h2>
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
        </div>
    );
};

export default ProjectDetails;
