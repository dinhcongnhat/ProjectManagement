

import { useState, useEffect } from 'react';
import { Users, FolderKanban, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

interface Project {
    id: number;
    name: string;
    progress: number;
    status: string;
}

const StatCard = ({ icon: Icon, label, value, color, trend }: any) => (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
            {trend !== null && (
                <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trend > 0 ? '+' : ''}{trend}%
                </span>
            )}
        </div>
        <h3 className="text-gray-500 text-sm font-medium">{label}</h3>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
);

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalProjects: 0,
        totalUsers: 0,
        completedProjects: 0,
        pendingProjects: 0
    });
    const [projects, setProjects] = useState<Project[]>([]);
    const { token } = useAuth();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [projectsRes, usersRes] = await Promise.all([
                    fetch(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
                ]);

                if (projectsRes.ok && usersRes.ok) {
                    const projectsData = await projectsRes.json();
                    const usersData = await usersRes.json();

                    const completed = projectsData.filter((p: Project) => p.status === 'COMPLETED').length;
                    const pending = projectsData.filter((p: Project) => p.status === 'PENDING_APPROVAL').length;

                    setStats({
                        totalProjects: projectsData.length,
                        totalUsers: usersData.length,
                        completedProjects: completed,
                        pendingProjects: pending
                    });

                    // Get top 3 projects by progress
                    setProjects(projectsData.slice(0, 3));
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };

        if (token) fetchStats();
    }, [token]);

    const statCards = [
        { icon: FolderKanban, label: 'Tổng dự án', value: stats.totalProjects, color: 'bg-blue-500', trend: null },
        { icon: Users, label: 'Thành viên', value: stats.totalUsers, color: 'bg-indigo-500', trend: null },
        { icon: CheckCircle2, label: 'Hoàn thành', value: stats.completedProjects, color: 'bg-green-500', trend: null },
        { icon: AlertCircle, label: 'Chờ duyệt', value: stats.pendingProjects, color: 'bg-orange-500', trend: null },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                <div className="flex gap-3">
                    <select title="Chọn khoảng thời gian" className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>7 ngày qua</option>
                        <option>Tháng này</option>
                        <option>Năm nay</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, index) => (
                    <StatCard key={index} {...stat} />
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Tiến độ dự án</h3>
                    {projects.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Chưa có dự án nào trong hệ thống
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {projects.map((project) => (
                                <div key={project.id} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-gray-700">{project.name}</span>
                                        <span className="text-gray-500">{project.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${project.status === 'COMPLETED' ? 'bg-green-500' :
                                                    project.status === 'PENDING_APPROVAL' ? 'bg-orange-500' :
                                                        'bg-blue-500'
                                                }`}
                                            style={{ width: `${project.progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

