import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

const UserDashboard = () => {
    const { user, token } = useAuth();
    const [stats, setStats] = useState({ todo: 0, inProgress: 0, completed: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/tasks', {
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
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
                <p className="text-gray-500 mt-1">Here's an overview of your work status.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">To Do</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.todo}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg text-orange-600">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">In Progress</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg text-green-600">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Completed</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
                <div className="text-center py-8 text-gray-500">
                    No recent activity to show.
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;
