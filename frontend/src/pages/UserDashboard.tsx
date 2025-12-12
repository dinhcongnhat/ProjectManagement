import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

const UserDashboard = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ todo: 0, inProgress: 0, completed: 0 });

    // Redirect Admin to admin dashboard
    useEffect(() => {
        if (user?.role === 'ADMIN') {
            navigate('/admin', { replace: true });
        }
    }, [user, navigate]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch(`${API_URL}/tasks`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();

                const todo = data.filter((t: any) => t.status === 'TODO').length;
                const inProgress = data.filter((t: any) => t.status === 'IN_PROGRESS').length;
                const completed = data.filter((t: any) => t.status === 'COMPLETED').length;

                setStats({ todo, inProgress, completed });
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };

        if (token) fetchStats();
    }, [token]);

    return (
        <div className="space-y-4 lg:space-y-6">
            {/* Welcome Card */}
            <div className="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200">
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Xin chào, {user?.name}!</h1>
                <p className="text-gray-500 mt-1 text-sm lg:text-base">Đây là tổng quan về công việc của bạn.</p>
            </div>

            {/* Stats Grid - Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-6">
                {/* Todo */}
                <div className="bg-white p-4 lg:p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-2.5 lg:p-3 bg-blue-100 rounded-lg text-blue-600 shrink-0">
                        <CheckCircle size={22} className="lg:w-6 lg:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs lg:text-sm text-gray-500">Cần làm</p>
                        <p className="text-xl lg:text-2xl font-bold text-gray-900">{stats.todo}</p>
                    </div>
                </div>

                {/* In Progress */}
                <div className="bg-white p-4 lg:p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-2.5 lg:p-3 bg-orange-100 rounded-lg text-orange-600 shrink-0">
                        <Clock size={22} className="lg:w-6 lg:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs lg:text-sm text-gray-500">Đang làm</p>
                        <p className="text-xl lg:text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                    </div>
                </div>

                {/* Completed */}
                <div className="bg-white p-4 lg:p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-2.5 lg:p-3 bg-green-100 rounded-lg text-green-600 shrink-0">
                        <AlertCircle size={22} className="lg:w-6 lg:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs lg:text-sm text-gray-500">Hoàn thành</p>
                        <p className="text-xl lg:text-2xl font-bold text-gray-900">{stats.completed}</p>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-4 lg:p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-base lg:text-lg font-bold text-gray-900 mb-4">Hoạt động gần đây</h2>
                <div className="text-center py-6 lg:py-8 text-gray-500 text-sm lg:text-base">
                    Chưa có hoạt động nào gần đây.
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;
