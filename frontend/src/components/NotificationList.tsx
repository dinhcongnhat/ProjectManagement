import { useState, useEffect, useRef } from 'react';
import {
    Bell, Trash2, Check, CheckCheck, X, Briefcase,
    Clock, Loader2, BellOff, MessageSquare, AtSign, ListTodo, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    projectId?: number;
    project?: { id: number; name: string; code: string };
    taskId?: number;
    isRead: boolean;
    readAt?: string;
    createdAt: string;
}

interface NotificationListProps {
    onClose: () => void;
}

const NotificationList = ({ onClose }: NotificationListProps) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await api.get('/notifications/list?limit=50');
            setNotifications(response.data.notifications);
            setUnreadCount(response.data.unreadCount);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id: number) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.put('/notifications/mark-all-read');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleting(id);
        try {
            await api.delete(`/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
            const notification = notifications.find(n => n.id === id);
            if (notification && !notification.isRead) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        } finally {
            setDeleting(null);
        }
    };

    const handleDeleteAllRead = async () => {
        try {
            await api.delete('/notifications/delete-read');
            setNotifications(prev => prev.filter(n => !n.isRead));
        } catch (error) {
            console.error('Error deleting read notifications:', error);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            handleMarkAsRead(notification.id);
        }

        const isAdmin = user?.role === 'ADMIN';
        const prefix = isAdmin ? '/admin' : '';
        const type = notification.type;

        // Map notification type → correct project tab or page
        if (type === 'PROJECT_DISCUSSION' && notification.projectId) {
            navigate(`${prefix}/projects/${notification.projectId}?tab=discussion`);
            onClose();
        } else if (type === 'MENTION' && notification.projectId) {
            navigate(`${prefix}/projects/${notification.projectId}?tab=discussion`);
            onClose();
        } else if (type === 'MENTION' && !notification.projectId) {
            onClose();
        } else if ((type === 'TASK_ASSIGNED' || type === 'TASK_REMINDER') && notification.projectId) {
            // Task notifications with project → go to project tasks tab
            navigate(`${prefix}/projects/${notification.projectId}?tab=tasks`);
            onClose();
        } else if ((type === 'TASK_DEADLINE_OVERDUE' || type === 'TASK_DEADLINE_UPCOMING') && notification.projectId) {
            navigate(`${prefix}/projects/${notification.projectId}?tab=tasks`);
            onClose();
        } else if (type === 'RESULT_REPORT_UPLOAD' && notification.projectId) {
            navigate(`${prefix}/projects/${notification.projectId}?tab=results`);
            onClose();
        } else if (type === 'FILE_UPLOAD' && notification.projectId) {
            navigate(`${prefix}/projects/${notification.projectId}?tab=attachments`);
            onClose();
        } else if (type === 'PROJECT_SUBMITTED' && notification.projectId) {
            navigate(`${prefix}/projects/${notification.projectId}?tab=overview`);
            onClose();
        } else if ((type === 'PROJECT_ASSIGNED' || type === 'PROJECT_UPDATED') && notification.projectId) {
            navigate(`${prefix}/projects/${notification.projectId}`);
            onClose();
        } else if ((type === 'DEADLINE' || type === 'DEADLINE_OVERDUE' || type === 'DEADLINE_UPCOMING') && notification.projectId) {
            navigate(`${prefix}/projects/${notification.projectId}?tab=overview`);
            onClose();
        } else if (notification.taskId && !notification.projectId) {
            // Task notification without project → go to my-tasks
            navigate(`${prefix}/my-tasks`);
            onClose();
        } else if (notification.projectId) {
            navigate(`${prefix}/projects/${notification.projectId}`);
            onClose();
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'PROJECT_ASSIGNED':
            case 'PROJECT_UPDATED':
                return <Briefcase size={18} className="text-blue-500" />;
            case 'PROJECT_DISCUSSION':
                return <MessageSquare size={18} className="text-emerald-500" />;
            case 'MENTION':
                return <AtSign size={18} className="text-purple-500" />;
            case 'TASK_ASSIGNED':
            case 'TASK_REMINDER':
                return <ListTodo size={18} className="text-indigo-500" />;
            case 'TASK_DEADLINE_OVERDUE':
            case 'TASK_DEADLINE_UPCOMING':
                return <AlertTriangle size={18} className="text-orange-500" />;
            case 'DEADLINE':
            case 'DEADLINE_OVERDUE':
            case 'DEADLINE_UPCOMING':
                return <Clock size={18} className="text-orange-500" />;
            case 'RESULT_REPORT_UPLOAD':
                return <span className="text-lg">📊</span>;
            case 'FILE_UPLOAD':
                return <span className="text-lg">📎</span>;
            case 'PROJECT_SUBMITTED':
                return <span className="text-lg">✅</span>;
            default:
                return <Bell size={18} className="text-gray-500" />;
        }
    };

    const formatTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Vừa xong';
            if (diffMins < 60) return `${diffMins} phút trước`;
            if (diffHours < 24) return `${diffHours} giờ trước`;
            if (diffDays < 7) return `${diffDays} ngày trước`;
            return date.toLocaleDateString('vi-VN');
        } catch {
            return '';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden max-h-[80vh] md:max-h-[500px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell size={20} />
                        <h3 className="font-semibold">Thông báo</h3>
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
                                {unreadCount} chưa đọc
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors md:hidden"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Actions */}
            {notifications.length > 0 && (
                <div className="px-4 py-2 border-b dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                    <button
                        onClick={handleMarkAllAsRead}
                        disabled={unreadCount === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <CheckCheck size={16} />
                        <span>Đọc tất cả</span>
                    </button>
                    <button
                        onClick={handleDeleteAllRead}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                        <span>Xóa đã đọc</span>
                    </button>
                </div>
            )}

            {/* Notifications List */}
            <div ref={listRef} className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-blue-500" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                        <BellOff size={48} className="mb-3" />
                        <p className="font-medium">Không có thông báo</p>
                        <p className="text-sm">Bạn sẽ thấy thông báo ở đây</p>
                    </div>
                ) : (
                    <div className="divide-y dark:divide-gray-700">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`relative px-4 py-3 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700 group ${!notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                                    }`}
                            >
                                <div className="flex gap-3">
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${!notification.isRead
                                        ? 'bg-blue-100 dark:bg-blue-900/50'
                                        : 'bg-gray-100 dark:bg-gray-700'
                                        }`}>
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm font-medium truncate ${!notification.isRead ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
                                                }`}>
                                                {notification.title}
                                            </p>
                                            {!notification.isRead && (
                                                <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {notification.project && (
                                                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                                                    {notification.project.code}
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                                {formatTime(notification.createdAt)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions - always visible on mobile, hover on desktop */}
                                    <div className="flex-shrink-0 flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        {!notification.isRead && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMarkAsRead(notification.id);
                                                }}
                                                className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:bg-blue-200 rounded-lg text-blue-600 dark:text-blue-400"
                                                title="Đánh dấu đã đọc"
                                            >
                                                <Check size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDelete(notification.id, e)}
                                            disabled={deleting === notification.id}
                                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/50 active:bg-red-200 rounded-lg text-red-500 dark:text-red-400"
                                            title="Xóa"
                                        >
                                            {deleting === notification.id ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationList;
