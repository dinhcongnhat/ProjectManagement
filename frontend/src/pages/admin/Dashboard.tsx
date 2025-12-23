import { useState, useEffect } from 'react';
import { Users, FolderKanban, CheckCircle2, AlertCircle, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

interface Project {
    id: number;
    name: string;
    progress: number;
    status: string;
}

const StatCard = ({ icon: Icon, label, value, gradient, shadowColor }: any) => (
    <div className="bg-white p-3 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all duration-300 group">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4">
            <div className={`p-2 sm:p-3 ${gradient} rounded-lg sm:rounded-xl text-white shadow-lg ${shadowColor} group-hover:scale-110 transition-transform w-fit`}>
                <Icon size={18} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mt-2 sm:mt-0">{value}</span>
        </div>
        <h3 className="text-xs sm:text-sm font-medium text-gray-500">{label}</h3>
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
    const { token, user } = useAuth();

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

                    setProjects(projectsData.slice(0, 5));
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };

        if (token) fetchStats();
    }, [token]);

    const statCards = [
        { icon: FolderKanban, label: 'Tổng dự án', value: stats.totalProjects, gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600', shadowColor: 'shadow-blue-500/30' },
        { icon: Users, label: 'Thành viên', value: stats.totalUsers, gradient: 'bg-gradient-to-br from-violet-500 to-purple-600', shadowColor: 'shadow-purple-500/30' },
        { icon: CheckCircle2, label: 'Hoàn thành', value: stats.completedProjects, gradient: 'bg-gradient-to-br from-emerald-500 to-green-600', shadowColor: 'shadow-green-500/30' },
        { icon: AlertCircle, label: 'Chờ duyệt', value: stats.pendingProjects, gradient: 'bg-gradient-to-br from-amber-500 to-orange-600', shadowColor: 'shadow-orange-500/30' },
    ];

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Welcome Header - Mobile Optimized */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 text-white shadow-xl shadow-purple-500/25 overflow-hidden relative">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6TTAgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
                <div className="relative">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="p-2.5 sm:p-3 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl shrink-0">
                            <Sparkles size={22} className="sm:w-7 sm:h-7" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Xin chào, {user?.name}!</h1>
                            <p className="text-purple-100 mt-0.5 sm:mt-1 text-sm sm:text-base">Bảng điều khiển quản trị.</p>
                        </div>
                    </div>

                    {/* Quick Stats in Header */}
                    <div className="mt-4 sm:mt-6 flex items-center gap-4 sm:gap-6 flex-wrap">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={16} className="text-green-300 sm:w-[18px] sm:h-[18px]" />
                            <span className="text-xs sm:text-sm text-purple-100">{stats.totalProjects} dự án</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-cyan-300 sm:w-[18px] sm:h-[18px]" />
                            <span className="text-xs sm:text-sm text-purple-100">{stats.totalUsers} thành viên</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid - 2x2 on mobile */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
                {statCards.map((stat, index) => (
                    <StatCard key={index} {...stat} />
                ))}
            </div>

            {/* Project Progress */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                        <FolderKanban size={18} className="text-indigo-600 sm:w-5 sm:h-5" />
                        Tiến độ dự án
                    </h3>
                    <Link
                        to="/admin/projects"
                        className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 group"
                    >
                        <span className="hidden sm:inline">Xem tất cả</span>
                        <span className="sm:hidden">Xem</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform sm:w-4 sm:h-4" />
                    </Link>
                </div>

                {projects.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 bg-gray-50 rounded-lg sm:rounded-xl">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                            <FolderKanban size={24} className="text-gray-400 sm:w-8 sm:h-8" />
                        </div>
                        <p className="text-gray-500 text-sm">Chưa có dự án nào</p>
                    </div>
                ) : (
                    <div className="space-y-2 sm:space-y-3">
                        {projects.map((project) => (
                            <div key={project.id} className="p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl hover:bg-gray-100 transition-colors active:bg-gray-200">
                                <div className="flex justify-between items-center mb-2 sm:mb-3">
                                    <span className="font-medium text-gray-800 text-sm sm:text-base truncate mr-3">{project.name}</span>
                                    <span className={`text-xs sm:text-sm font-bold shrink-0 ${project.status === 'COMPLETED' ? 'text-green-600' :
                                            project.status === 'PENDING_APPROVAL' ? 'text-orange-600' :
                                                'text-blue-600'
                                        }`}>
                                        {project.progress}%
                                    </span>
                                </div>
                                <div className="h-2 sm:h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${project.status === 'COMPLETED' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                                                project.status === 'PENDING_APPROVAL' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                                                    'bg-gradient-to-r from-blue-500 to-indigo-500'
                                            }`}
                                        style={{ width: `${project.progress}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
