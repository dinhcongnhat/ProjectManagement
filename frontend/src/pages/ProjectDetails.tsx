import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar, User, Users, Eye, Clock } from 'lucide-react';

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
}

const ProjectDetails = () => {
    const { id } = useParams();
    const { token } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/projects/${id}`, {
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

        if (token && id) fetchProject();
    }, [token, id]);

    if (loading) return <div className="p-6">Loading...</div>;
    if (!project) return <div className="p-6">Project not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/projects" className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                    <p className="text-gray-500 text-sm">Mã dự án: {project.code}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Mô tả dự án</h2>
                        <div className="prose max-w-none text-gray-600">
                            {project.description || 'Chưa có mô tả.'}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Thông tin chi tiết</h2>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Nhóm dự án</p>
                                <p className="font-medium">{project.group || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Giá trị</p>
                                <p className="font-medium">{project.value || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Phương thức tiến độ</p>
                                <p className="font-medium">{project.progressMethod || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Thời lượng</p>
                                <p className="font-medium">{project.duration || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Thời gian</h2>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Ngày bắt đầu</p>
                                    <p className="font-medium">
                                        {project.startDate ? new Date(project.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Ngày kết thúc</p>
                                    <p className="font-medium">
                                        {project.endDate ? new Date(project.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Thành viên</h2>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                    <User size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Quản trị dự án</p>
                                    <p className="font-medium">{project.manager?.name || 'Chưa gán'}</p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Users size={16} className="text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">Người thực hiện ({project.implementers?.length || 0})</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {project.implementers?.map(user => (
                                        <span key={user.id} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                            {user.name}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Eye size={16} className="text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">Người theo dõi ({project.followers?.length || 0})</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {project.followers?.map(user => (
                                        <span key={user.id} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                            {user.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectDetails;
