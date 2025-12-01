

import { useState, useEffect } from 'react';
import { Users, FolderKanban, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ icon: Icon, label, value, color, trend }: any) => (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
            <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend > 0 ? '+' : ''}{trend}%
            </span>
        </div>
        <h3 className="text-gray-500 text-sm font-medium">{label}</h3>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
);

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalProjects: 0,
        totalUsers: 0,
        completedTasks: 0,
        overdueTasks: 0
    });
    const { token } = useAuth();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch tasks and users to calculate stats
                // In a real app, we should have a dedicated /api/stats endpoint
                // For now, we'll fetch all tasks and users and calculate client-side or just mock for demo if API is limited
                // Let's try to fetch tasks and users
                const [tasksRes, usersRes] = await Promise.all([
                    fetch('http://localhost:3000/api/tasks', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('http://localhost:3000/api/users', { headers: { Authorization: `Bearer ${token}` } })
                ]);

                const tasks = await tasksRes.json();
                const users = await usersRes.json();

                const completed = tasks.filter((t: any) => t.status === 'COMPLETED').length;
                // Overdue logic needs dates, for now just mock or 0
                const overdue = 0;

                setStats({
                    totalProjects: tasks.length, // Using tasks as proxy for projects/work items
                    totalUsers: users.length,
                    completedTasks: completed,
                    overdueTasks: overdue
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };

        if (token) fetchStats();
    }, [token]);

    const statCards = [
        { icon: FolderKanban, label: 'Tổng công việc', value: stats.totalProjects, color: 'bg-blue-500', trend: 8.5 },
        { icon: Users, label: 'Thành viên', value: stats.totalUsers, color: 'bg-indigo-500', trend: 12 },
        { icon: CheckCircle2, label: 'Hoàn thành', value: stats.completedTasks, color: 'bg-green-500', trend: 5.2 },
        { icon: AlertCircle, label: 'Trễ hạn', value: stats.overdueTasks, color: 'bg-red-500', trend: -2.4 },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                <div className="flex gap-3">
                    <select className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Tiến độ dự án</h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-700">Website Redesign {i}</span>
                                    <span className="text-gray-500">75%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '75%' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Hoạt động gần đây</h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-start gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                                    JD
                                </div>
                                <div>
                                    <p className="text-sm text-gray-900"><span className="font-medium">John Doe</span> đã hoàn thành task <span className="font-medium">Update Homepage</span></p>
                                    <p className="text-xs text-gray-500 mt-1">2 giờ trước</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
