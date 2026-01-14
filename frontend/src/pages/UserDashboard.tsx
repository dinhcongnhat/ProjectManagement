import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { CheckCircle, Clock, AlertCircle, Sparkles, ArrowRight, Briefcase, ListTodo } from 'lucide-react';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring' as const,
            stiffness: 300,
            damping: 24
        }
    }
};

const UserDashboard = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [activities, setActivities] = useState<any[]>([]);
    const [stats, setStats] = useState({ todo: 0, inProgress: 0, completed: 0 });

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

    const totalTasks = stats.todo + stats.inProgress + stats.completed;
    const completionRate = totalTasks > 0 ? Math.round((stats.completed / totalTasks) * 100) : 0;

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const response = await fetch(`${API_URL}/activities?limit=5`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (response.ok) {
                    const data = await response.json();
                    setActivities(data.activities);
                }
            } catch (error) {
                console.error('Error fetching activities:', error);
            }
        };

        if (token) fetchActivities();
    }, [token]);

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Vừa xong';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} phút trước`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} giờ trước`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    };

    const getActivityIcon = (activity: any) => {
        const action = activity.action;
        const activityType = activity.activityType;

        // Message activities
        if (activityType === 'MESSAGE' || action.includes('MESSAGE') || action.includes('SEND')) {
            if (activity.messageType === 'IMAGE') return <Sparkles size={16} className="text-pink-600" />;
            if (activity.messageType === 'VIDEO') return <Sparkles size={16} className="text-purple-600" />;
            return <Sparkles size={16} className="text-indigo-600" />;
        }

        // Task activities
        if (activityType === 'TASK' || action.includes('TASK')) {
            return <ListTodo size={16} className="text-cyan-600" />;
        }

        if (action.includes('CREATE')) return <Sparkles size={16} className="text-green-600" />;
        if (action.includes('UPDATE')) return <Briefcase size={16} className="text-blue-600" />;
        if (action.includes('DELETE')) return <AlertCircle size={16} className="text-red-600" />;
        if (action.includes('ASSIGN')) return <ListTodo size={16} className="text-purple-600" />;
        return <Clock size={16} className="text-gray-600" />;
    };

    const getActivityText = (activity: any) => {
        // Handle different activity types
        const activityType = activity.activityType;

        // Message activities
        if (activityType === 'MESSAGE') {
            const messageTypeText: Record<string, string> = {
                'TEXT': 'đã gửi tin nhắn trong',
                'IMAGE': 'đã gửi hình ảnh trong',
                'VIDEO': 'đã gửi video trong',
                'FILE': 'đã gửi tệp đính kèm trong',
                'VOICE': 'đã gửi tin nhắn thoại trong',
                'TEXT_WITH_FILE': 'đã gửi tin nhắn có tệp trong'
            };
            const actionText = messageTypeText[activity.messageType] || 'đã gửi tin nhắn trong';

            return (
                <span>
                    <span className="font-semibold text-gray-900">{activity.user?.name || 'Ai đó'}</span>{' '}
                    <span className="text-gray-600">{actionText}</span>{' '}
                    <Link to={`/projects/${activity.project?.id}`} className="font-medium text-blue-600 hover:underline">
                        {activity.project?.name || 'dự án'}
                    </Link>
                </span>
            );
        }

        // Task activities
        if (activityType === 'TASK') {
            const isNew = activity.action === 'CREATE_TASK';
            const statusText: Record<string, string> = {
                'TODO': 'cần làm',
                'IN_PROGRESS': 'đang làm',
                'COMPLETED': 'đã hoàn thành'
            };
            const status = activity.taskStatus ? ` (${statusText[activity.taskStatus] || activity.taskStatus})` : '';

            return (
                <span>
                    <span className="font-semibold text-gray-900">{activity.user?.name || 'Ai đó'}</span>{' '}
                    <span className="text-gray-600">{isNew ? 'được giao công việc' : 'cập nhật công việc'}</span>{' '}
                    <span className="font-medium text-gray-800">"{activity.newValue}"</span>
                    <span className="text-gray-500">{status}</span>
                    {activity.project && (
                        <>
                            {' trong '}
                            <Link to={`/projects/${activity.project.id}`} className="font-medium text-blue-600 hover:underline">
                                {activity.project.name}
                            </Link>
                        </>
                    )}
                </span>
            );
        }

        // Project activities (default)
        const actionMap: Record<string, string> = {
            'CREATE_PROJECT': 'đã tạo dự án',
            'UPDATE_PROJECT': 'đã cập nhật dự án',
            'DELETE_PROJECT': 'đã xóa dự án',
            'UPDATE_STATUS': 'đã cập nhật trạng thái',
            'ASSIGN_MANAGER': 'đã gán quản lý',
            'ASSIGN_IMPLEMENTER': 'đã gán người thực hiện',
            'ASSIGN_COOPERATOR': 'đã gán người phối hợp',
            'UPLOAD_ATTACHMENT': 'đã tải lên tệp đính kèm',
            'CREATE_SUBPROJECT': 'đã tạo dự án con',
            'SEND_IMAGE': 'đã gửi hình ảnh trong',
            'SEND_VIDEO': 'đã gửi video trong',
            'SEND_VOICE': 'đã gửi tin nhắn thoại trong',
            'SEND_ATTACHMENT': 'đã gửi tệp đính kèm trong'
        };

        let actionText = actionMap[activity.action] || activity.action;

        return (
            <span>
                <span className="font-semibold text-gray-900">{activity.user?.name || 'Ai đó'}</span>{' '}
                <span className="text-gray-600">{actionText}</span>{' '}
                <Link to={`/projects/${activity.project?.id}`} className="font-medium text-blue-600 hover:underline">
                    {activity.project?.name || 'dự án'}
                </Link>
            </span>
        );
    };

    return (
        <motion.div
            className="space-y-4 sm:space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Welcome Card - Mobile Optimized */}
            <motion.div
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 text-white shadow-xl shadow-blue-500/25 overflow-hidden relative"
                variants={itemVariants}
            >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6TTAgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
                <div className="relative">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <motion.div
                            className="p-2.5 sm:p-3 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl shrink-0"
                            whileHover={{ scale: 1.1, rotate: 5 }}
                        >
                            <Sparkles size={22} className="sm:w-7 sm:h-7" />
                        </motion.div>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Xin chào, {user?.name}!</h1>
                            <p className="text-blue-100 mt-0.5 sm:mt-1 text-sm sm:text-base">Tổng quan công việc của bạn.</p>
                        </div>
                    </div>

                    {/* Quick Stats in Header */}
                    <div className="mt-4 sm:mt-6 flex items-center gap-4 sm:gap-6 flex-wrap">
                        <div className="flex items-center gap-2">
                            <motion.div
                                className="w-2 h-2 bg-cyan-400 rounded-full"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                            <span className="text-xs sm:text-sm text-blue-100">{totalTasks} công việc</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <motion.div
                                className="w-2 h-2 bg-green-400 rounded-full"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                            />
                            <span className="text-xs sm:text-sm text-blue-100">{completionRate}% hoàn thành</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid - Mobile 3 columns */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
                {/* Todo */}
                <motion.div
                    className="bg-white p-3 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 group"
                    variants={itemVariants}
                    whileHover={{ y: -4, boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15)' }}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4">
                        <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-blue-500/30 w-fit">
                            <CheckCircle size={18} className="sm:w-6 sm:h-6" />
                        </div>
                        <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mt-2 sm:mt-0">{stats.todo}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Cần làm</p>
                    <div className="mt-2 sm:mt-3 h-1 sm:h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${totalTasks > 0 ? (stats.todo / totalTasks) * 100 : 0}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                        />
                    </div>
                </motion.div>

                {/* In Progress */}
                <motion.div
                    className="bg-white p-3 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 group"
                    variants={itemVariants}
                    whileHover={{ y: -4, boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15)' }}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4">
                        <div className="p-2 sm:p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-orange-500/30 w-fit">
                            <Clock size={18} className="sm:w-6 sm:h-6" />
                        </div>
                        <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mt-2 sm:mt-0">{stats.inProgress}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Đang làm</p>
                    <div className="mt-2 sm:mt-3 h-1 sm:h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${totalTasks > 0 ? (stats.inProgress / totalTasks) * 100 : 0}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                        />
                    </div>
                </motion.div>

                {/* Completed */}
                <motion.div
                    className="bg-white p-3 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 group"
                    variants={itemVariants}
                    whileHover={{ y: -4, boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15)' }}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4">
                        <div className="p-2 sm:p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-green-500/30 w-fit">
                            <AlertCircle size={18} className="sm:w-6 sm:h-6" />
                        </div>
                        <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mt-2 sm:mt-0">{stats.completed}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Xong</p>
                    <div className="mt-2 sm:mt-3 h-1 sm:h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${totalTasks > 0 ? (stats.completed / totalTasks) * 100 : 0}%` }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                        />
                    </div>
                </motion.div>
            </div>

            {/* Quick Actions - Stack on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                <motion.div variants={itemVariants}>
                    <Link
                        to="/projects"
                        className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:border-blue-200 transition-all duration-300 group flex items-center gap-3 sm:gap-4 active:scale-[0.98]"
                    >
                        <div className="p-2.5 sm:p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-purple-500/30 shrink-0">
                            <Briefcase size={20} className="sm:w-6 sm:h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base">Dự án của tôi</h3>
                            <p className="text-xs sm:text-sm text-gray-500 truncate">Xem và quản lý dự án</p>
                        </div>
                        <ArrowRight size={18} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0 sm:w-5 sm:h-5" />
                    </Link>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Link
                        to="/my-tasks"
                        className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:border-blue-200 transition-all duration-300 group flex items-center gap-3 sm:gap-4 active:scale-[0.98]"
                    >
                        <div className="p-2.5 sm:p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-blue-500/30 shrink-0">
                            <ListTodo size={20} className="sm:w-6 sm:h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base">Công việc của tôi</h3>
                            <p className="text-xs sm:text-sm text-gray-500 truncate">Xem tất cả công việc</p>
                        </div>
                        <ArrowRight size={18} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0 sm:w-5 sm:h-5" />
                    </Link>
                </motion.div>
            </div>

            {/* Recent Activity */}
            <motion.div
                className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50"
                variants={itemVariants}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Clock size={18} className="text-indigo-600 sm:w-5 sm:h-5" />
                        Hoạt động gần đây
                    </h2>
                    <Link to="/activities" className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Xem tất cả
                    </Link>
                </div>

                {activities.length > 0 ? (
                    <div className="space-y-4">
                        {activities.map((activity, index) => (
                            <motion.div
                                key={activity.id}
                                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                                    {getActivityIcon(activity)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        {getActivityText(activity)}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {formatTimeAgo(activity.createdAt)}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 sm:py-12 bg-gray-50 rounded-lg sm:rounded-xl">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                            <Clock size={20} className="text-gray-400 sm:w-6 sm:h-6" />
                        </div>
                        <p className="text-gray-500 text-sm">Chưa có hoạt động nào gần đây.</p>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default UserDashboard;

