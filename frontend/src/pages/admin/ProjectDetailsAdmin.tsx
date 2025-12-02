import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Calendar, User, Users, Eye, Clock, CheckCircle2, AlertCircle, FileText, Image as ImageIcon, X, MessageSquare, History } from 'lucide-react';

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

const ProjectDetailsAdmin = () => {
    const { id } = useParams();
    const { token } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'discussion' | 'activity'>('info');

    const fetchProject = async () => {
        try {
            const response = await fetch(`http://localhost:3000/api/projects/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setProject(data);

                // Fetch image as blob if it's an image attachment
                if (data.attachment && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(data.attachment.split('.').pop()?.toLowerCase() || '')) {
                    const imgResponse = await fetch(`http://localhost:3000/api/projects/${data.id}/attachment`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (imgResponse.ok) {
                        const blob = await imgResponse.blob();
                        const url = URL.createObjectURL(blob);
                        setImageUrl(url);
                    }
                }
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
            const response = await fetch(`http://localhost:3000/api/projects/${project.id}/approve`, {
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

                                            {/* Compact Progress Bar */}
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${project.status === 'COMPLETED' ? 'bg-green-500' :
                                                        project.status === 'PENDING_APPROVAL' ? 'bg-orange-500' :
                                                            'bg-blue-500'
                                                        }`}
                                                    style={{ width: `${project.progress}%` }}
                                                ></div>
                                            </div>

                                            {/* Compact Slider */}
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={project.progress}
                                                onChange={async (e) => {
                                                    const newProgress = Number(e.target.value);
                                                    try {
                                                        const response = await fetch(`http://localhost:3000/api/projects/${project.id}/progress`, {
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
                                                className={`w-full h-3 rounded-lg appearance-none cursor-pointer ${project.status === 'COMPLETED' ? 'opacity-50 cursor-not-allowed' : ''
                                                    }`}
                                                style={{
                                                    background: project.status === 'COMPLETED'
                                                        ? `linear-gradient(to right, #10b981 0%, #10b981 ${project.progress}%, #d1fae5 ${project.progress}%, #d1fae5 100%)`
                                                        : project.status === 'PENDING_APPROVAL'
                                                            ? `linear-gradient(to right, #f97316 0%, #f97316 ${project.progress}%, #fed7aa ${project.progress}%, #fed7aa 100%)`
                                                            : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${project.progress}%, #bfdbfe ${project.progress}%, #bfdbfe 100%)`
                                                }}
                                            />
                                            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${project.status === 'COMPLETED' ? 'bg-green-500' :
                                                        project.status === 'PENDING_APPROVAL' ? 'bg-orange-500' :
                                                            'bg-blue-500'
                                                        }`}
                                                    style={{ width: `${project.progress}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Quick Select Dropdown */}
                                        <div className="flex items-center gap-3">
                                            <label className="text-sm font-medium text-gray-700">Chọn nhanh:</label>
                                            <select
                                                value={project.progress}
                                                onChange={async (e) => {
                                                    const newProgress = Number(e.target.value);
                                                    try {
                                                        const response = await fetch(`http://localhost:3000/api/projects/${project.id}/progress`, {
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
                                                className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <option value="0">0% - Chưa bắt đầu</option>
                                                <option value="25">25% - Đang tiến hành</option>
                                                <option value="50">50% - Hoàn thành một nửa</option>
                                                <option value="75">75% - Gần hoàn thành</option>
                                                <option value="100">100% - Hoàn thành</option>
                                            </select>
                                        </div>

                                        {/* Status Message */}
                                        {project.status === 'PENDING_APPROVAL' && (
                                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                                <p className="text-sm text-orange-800 font-medium text-center">
                                                    ⏳ Dự án đang chờ duyệt
                                                </p>
                                            </div>
                                        )}
                                        {project.status === 'COMPLETED' && (
                                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                                <p className="text-sm text-green-800 font-medium text-center">
                                                    ✅ Dự án đã được duyệt và hoàn thành
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Timeline Section - Right Column */}
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
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <FileText size={18} className="text-blue-600" />
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
                                        onClick={() => {
                                            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(project.attachment?.split('.').pop()?.toLowerCase() || '');
                                            if (isImage && imageUrl) {
                                                setPreviewImage(imageUrl);
                                            } else {
                                                window.open(`http://localhost:3000/api/projects/${project.id}/attachment`, '_blank');
                                            }
                                        }}
                                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border-2 border-gray-200 hover:border-blue-400 cursor-pointer transition-all hover:shadow-md group"
                                    >
                                        <div className="p-3 bg-white rounded-lg border border-gray-200 group-hover:border-blue-400 transition-colors">
                                            {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(project.attachment?.split('.').pop()?.toLowerCase() || '') ? (
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
                                                {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(project.attachment?.split('.').pop()?.toLowerCase() || '') ? 'Click để xem ảnh' : 'Click để tải xuống'}
                                            </p>
                                        </div>
                                        <div className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg group-hover:bg-blue-700 transition-colors">
                                            {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(project.attachment?.split('.').pop()?.toLowerCase() || '') ? '👁️ Xem' : '⬇️ Tải'}
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
                        </div>
                    </div>
                )}

                {/* Discussion Tab */}
                {activeTab === 'discussion' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="h-96 flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Tính năng thảo luận đang được phát triển</p>
                                <p className="text-sm mt-2">Bạn sẽ có thể gửi tin nhắn, file đính kèm và ghi âm tại đây</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Activity History Tab */}
                {activeTab === 'activity' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Lịch sử hoạt động</h2>
                        <div className="space-y-3">
                            {/* Placeholder - this will be replaced with actual activity data */}
                            <div className="text-center text-gray-500 py-8">
                                <History size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Chưa có hoạt động nào được ghi nhận</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Image Preview Modal */}
                {previewImage && (
                    <div
                        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setPreviewImage(null)}
                    >
                        <button
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
            </div>
        </div >
    );
};

export default ProjectDetailsAdmin;
