import { useState, useEffect, useRef } from 'react';
import {
    Bell, Trash2, Check, CheckCheck, X, Briefcase,
    Clock, Loader2, BellOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';

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

        if (notification.projectId) {
            navigate(`/projects/${notification.projectId}`);
            onClose();
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'PROJECT_ASSIGNED':
            case 'PROJECT_UPDATED':
                return <Briefcase size={18} className="text-blue-500" />;
            case 'DEADLINE':
                return <Clock size={18} className="text-orange-500" />;
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
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[80vh] md:max-h-[500px] flex flex-col">
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
                <div className="px-4 py-2 border-b flex items-center justify-between bg-gray-50">
                    <button
                        onClick={handleMarkAllAsRead}
                        disabled={unreadCount === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <CheckCheck size={16} />
                        <span>Đọc tất cả</span>
                    </button>
                    <button
                        onClick={handleDeleteAllRead}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <BellOff size={48} className="mb-3" />
                        <p className="font-medium">Không có thông báo</p>
                        <p className="text-sm">Bạn sẽ thấy thông báo ở đây</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`relative px-4 py-3 cursor-pointer transition-all hover:bg-gray-50 group ${!notification.isRead ? 'bg-blue-50/50' : ''
                                    }`}
                            >
                                <div className="flex gap-3">
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${!notification.isRead
                                        ? 'bg-blue-100'
                                        : 'bg-gray-100'
                                        }`}>
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm font-medium truncate ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'
                                                }`}>
                                                {notification.title}
                                            </p>
                                            {!notification.isRead && (
                                                <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {notification.project && (
                                                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                                    {notification.project.code}
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400">
                                                {formatTime(notification.createdAt)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!notification.isRead && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMarkAsRead(notification.id);
                                                }}
                                                className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600"
                                                title="Đánh dấu đã đọc"
                                            >
                                                <Check size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDelete(notification.id, e)}
                                            disabled={deleting === notification.id}
                                            className="p-1.5 hover:bg-red-100 rounded-lg text-red-500"
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
