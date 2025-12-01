import { useState, useEffect } from 'react';
import { Briefcase, Calendar, User, Users, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Project {
    id: number;
    code: string;
    name: string;
    manager: { id: number, name: string };
    implementers: { id: number, name: string }[];
    followers: { id: number, name: string }[];
    startDate: string;
    endDate: string;
}

const UserProjects = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const { token, user } = useAuth();

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/projects', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                if (Array.isArray(data)) {
                    // Filter projects where user is involved
                    const myProjects = data.filter(project =>
                        project.manager?.id === user?.id ||
                        project.implementers?.some((imp: { id: number }) => imp.id === user?.id) ||
                        project.followers?.some((fol: { id: number }) => fol.id === user?.id)
                    );
                    setProjects(myProjects);
                }
            } catch (error) {
                console.error('Error fetching projects:', error);
            }
        };

        if (token && user) fetchProjects();
    }, [token, user]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Dự án của tôi</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500">
                        Chưa có dự án nào được giao cho bạn.
                    </div>
                ) : (
                    projects.map((project) => (
                        <div key={project.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                                    <Briefcase size={24} />
                                </div>
                                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                                    {project.code}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-2">{project.name}</h3>

                            <div className="space-y-3">
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
                                <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-1 text-xs text-gray-500" title="Người thực hiện">
                                        <Users size={14} />
                                        <span>{project.implementers?.length || 0}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500" title="Người theo dõi">
                                        <Eye size={14} />
                                        <span>{project.followers?.length || 0}</span>
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
