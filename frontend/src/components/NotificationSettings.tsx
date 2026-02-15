import React from 'react';
import { Bell, BellOff, MessageSquare, Briefcase, Users, CheckCircle2, AtSign, History, RefreshCw, LayoutDashboard } from 'lucide-react';
import { usePushNotifications } from '../context/PushNotificationContext';

interface NotificationSettingsProps {
    onClose?: () => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onClose }) => {
    const {
        isSupported,
        isSubscribed,
        permission,
        settings,
        loading,
        error,
        subscribe,
        unsubscribe,
        updateSettings,
        sendTestNotification
    } = usePushNotifications();

    const handleToggleSubscription = async () => {
        if (isSubscribed) {
            await unsubscribe();
        } else {
            await subscribe();
        }
    };

    const handleSettingChange = (key: string, value: boolean) => {
        updateSettings({ [key]: value });
    };

    if (!isSupported) {
        return (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div className="flex items-center gap-3 text-yellow-800">
                    <BellOff size={24} />
                    <div>
                        <p className="font-semibold">Thông báo đẩy không được hỗ trợ</p>
                        <p className="text-sm text-yellow-700">
                            Trình duyệt của bạn không hỗ trợ thông báo đẩy. 
                            Vui lòng sử dụng Chrome, Firefox, Edge hoặc Safari mới nhất.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white md:rounded-xl shadow-lg border border-gray-200 overflow-hidden md:max-w-sm rounded-t-2xl md:rounded-t-xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell size={20} />
                        <h2 className="font-bold">Cài đặt thông báo</h2>
                    </div>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] md:max-h-[70vh] overflow-y-auto">
                {/* Error message */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Permission status */}
                {permission === 'denied' && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                        <p className="text-orange-800 font-medium">⚠️ Quyền thông báo bị từ chối</p>
                        <p className="text-orange-700">Vui lòng bật trong cài đặt trình duyệt.</p>
                    </div>
                )}

                {/* Main toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isSubscribed ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                            {isSubscribed ? <Bell size={20} /> : <BellOff size={20} />}
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 text-sm">
                                {isSubscribed ? 'Thông báo đang bật' : 'Thông báo đang tắt'}
                            </p>
                            <p className="text-xs text-gray-500">
                                {isSubscribed ? 'Nhận thông báo trên thiết bị này' : 'Bật để nhận thông báo'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleToggleSubscription}
                        disabled={loading || permission === 'denied'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isSubscribed ? 'bg-green-500' : 'bg-gray-300'
                        } ${loading ? 'opacity-50' : ''} disabled:cursor-not-allowed`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                                isSubscribed ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                        {loading && (
                            <RefreshCw size={12} className="absolute left-1/2 -translate-x-1/2 animate-spin text-white" />
                        )}
                    </button>
                </div>

                {/* Notification types */}
                {isSubscribed && settings && (
                    <div className="space-y-1">
                        <h3 className="font-medium text-gray-700 text-sm px-1">Loại thông báo</h3>
                        
                        <div className="space-y-0.5">
                            {/* Chat messages */}
                            <SettingToggle
                                icon={<MessageSquare size={16} />}
                                title="Tin nhắn chat"
                                checked={settings.chatMessages}
                                onChange={(v) => handleSettingChange('chatMessages', v)}
                            />

                            {/* Project assignments */}
                            <SettingToggle
                                icon={<Briefcase size={16} />}
                                title="Phân công dự án"
                                checked={settings.projectAssignments}
                                onChange={(v) => handleSettingChange('projectAssignments', v)}
                            />

                            {/* Project discussions */}
                            <SettingToggle
                                icon={<Users size={16} />}
                                title="Thảo luận dự án"
                                checked={settings.projectDiscussions}
                                onChange={(v) => handleSettingChange('projectDiscussions', v)}
                            />

                            {/* Project updates */}
                            <SettingToggle
                                icon={<History size={16} />}
                                title="Cập nhật dự án"
                                checked={settings.projectUpdates}
                                onChange={(v) => handleSettingChange('projectUpdates', v)}
                            />

                            {/* Task assignments */}
                            <SettingToggle
                                icon={<CheckCircle2 size={16} />}
                                title="Công việc được giao"
                                checked={settings.taskAssignments}
                                onChange={(v) => handleSettingChange('taskAssignments', v)}
                            />

                            {/* Mentions */}
                            <SettingToggle
                                icon={<AtSign size={16} />}
                                title="Được nhắc đến"
                                checked={settings.mentions}
                                onChange={(v) => handleSettingChange('mentions', v)}
                            />

                            {/* Kanban notifications */}
                            <SettingToggle
                                icon={<LayoutDashboard size={16} />}
                                title="Thông báo Kanban"
                                checked={settings.kanbanNotifications}
                                onChange={(v) => handleSettingChange('kanbanNotifications', v)}
                            />
                        </div>
                    </div>
                )}

                {/* Test notification */}
                {isSubscribed && (
                    <button
                        onClick={sendTestNotification}
                        className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Bell size={16} />
                        Gửi thông báo thử nghiệm
                    </button>
                )}
            </div>
        </div>
    );
};

// Toggle component - compact version
interface SettingToggleProps {
    icon: React.ReactNode;
    title: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({
    icon,
    title,
    checked,
    onChange
}) => (
    <div className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded-lg transition-colors">
        <div className="flex items-center gap-2">
            <div className="text-gray-400">{icon}</div>
            <p className="text-sm text-gray-700">{title}</p>
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                checked ? 'bg-blue-500' : 'bg-gray-300'
            }`}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    checked ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
            />
        </button>
    </div>
);

export default NotificationSettings;
