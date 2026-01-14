import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { Clock, Sparkles, Briefcase, AlertCircle, ListTodo, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

interface Activity {
    id: string | number;
    action: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    createdAt: string;
    user?: { id: number; name: string; role: string };
    project?: { id: number; name: string; code?: string };
    activityType?: string;
    messageType?: string;
    taskId?: number;
    taskStatus?: string;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
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

const Activities = () => {
    const { token } = useAuth();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 20;

    useEffect(() => {
        const fetchActivities = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${API_URL}/activities?page=${page}&limit=${limit}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (response.ok) {
                    const data = await response.json();
                    setActivities(data.activities || []);
                    setTotalPages(data.pagination?.pages || 1);
                }
            } catch (error) {
                console.error('Error fetching activities:', error);
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchActivities();
    }, [token, page]);

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

    const getActivityIcon = (activity: Activity) => {
        const action = activity.action;
        const activityType = activity.activityType;

        if (activityType === 'MESSAGE' || action.includes('MESSAGE') || action.includes('SEND')) {
            if (activity.messageType === 'IMAGE') return <Sparkles size={18} className="text-pink-600" />;
            if (activity.messageType === 'VIDEO') return <Sparkles size={18} className="text-purple-600" />;
            return <Sparkles size={18} className="text-indigo-600" />;
        }

        if (activityType === 'TASK' || action.includes('TASK')) {
            return <ListTodo size={18} className="text-cyan-600" />;
        }

        if (action.includes('CREATE')) return <Sparkles size={18} className="text-green-600" />;
        if (action.includes('UPDATE')) return <Briefcase size={18} className="text-blue-600" />;
        if (action.includes('DELETE')) return <AlertCircle size={18} className="text-red-600" />;
        if (action.includes('ASSIGN')) return <ListTodo size={18} className="text-purple-600" />;
        return <Clock size={18} className="text-gray-600" />;
    };

    const getActivityText = (activity: Activity) => {
        const activityType = activity.activityType;

        if (activityType === 'MESSAGE') {
            const messageTypeText: Record<string, string> = {
                'TEXT': 'đã gửi tin nhắn trong',
                'IMAGE': 'đã gửi hình ảnh trong',
                'VIDEO': 'đã gửi video trong',
                'FILE': 'đã gửi tệp đính kèm trong',
                'VOICE': 'đã gửi tin nhắn thoại trong',
                'TEXT_WITH_FILE': 'đã gửi tin nhắn có tệp trong'
            };
            const actionText = messageTypeText[activity.messageType || ''] || 'đã gửi tin nhắn trong';

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

        const actionText = actionMap[activity.action] || activity.action;

        return (
            <span>
                <span className="font-semibold text-gray-900">{activity.user?.name || 'Ai đó'}</span>{' '}
                <span className="text-gray-600">{actionText}</span>{' '}
                {activity.project && (
                    <Link to={`/projects/${activity.project.id}`} className="font-medium text-blue-600 hover:underline">
                        {activity.project.name || 'dự án'}
                    </Link>
                )}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    to="/"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} className="text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Hoạt động gần đây</h1>
                    <p className="text-gray-500 text-sm">Theo dõi tất cả hoạt động trong các dự án của bạn</p>
                </div>
            </div>

            {/* Activities List */}
            <motion.div
                className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 overflow-hidden"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-500">Đang tải...</p>
                    </div>
                ) : activities.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {activities.map((activity) => (
                            <motion.div
                                key={activity.id}
                                className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                                variants={itemVariants}
                            >
                                <div className="p-2.5 bg-gray-100 rounded-xl shrink-0">
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
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Clock size={28} className="text-gray-400" />
                        </div>
                        <p className="text-gray-500">Chưa có hoạt động nào gần đây.</p>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} />
                            Trước
                        </button>
                        <span className="text-sm text-gray-600">
                            Trang {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Sau
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default Activities;
