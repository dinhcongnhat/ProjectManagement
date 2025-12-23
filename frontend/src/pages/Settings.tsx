import { useState } from 'react';
import { ArrowLeft, Bell, Shield, Palette, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationSettings from '../components/NotificationSettings';

type SettingsTab = 'notifications' | 'security' | 'appearance' | 'about';

const Settings = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<SettingsTab>('notifications');

    const tabs = [
        { id: 'notifications' as const, label: 'Thông báo', icon: Bell },
        { id: 'security' as const, label: 'Bảo mật', icon: Shield },
        { id: 'appearance' as const, label: 'Giao diện', icon: Palette },
        { id: 'about' as const, label: 'Thông tin', icon: Info },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900">Cài đặt</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar */}
                    <div className="md:w-64 flex-shrink-0">
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === tab.id
                                            ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                                            : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'
                                        }`}
                                >
                                    <tab.icon size={20} />
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        {activeTab === 'notifications' && (
                            <div className="bg-white rounded-xl border shadow-sm p-6">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Cài đặt thông báo</h2>
                                <p className="text-gray-600 mb-6">
                                    Quản lý cách bạn nhận thông báo từ ứng dụng.
                                </p>
                                <NotificationSettings />
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="bg-white rounded-xl border shadow-sm p-6">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Bảo mật</h2>
                                <p className="text-gray-500">
                                    Các tùy chọn bảo mật sẽ được cập nhật trong phiên bản tiếp theo.
                                </p>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="bg-white rounded-xl border shadow-sm p-6">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Giao diện</h2>
                                <p className="text-gray-500">
                                    Tùy chỉnh giao diện sẽ được cập nhật trong phiên bản tiếp theo.
                                </p>
                            </div>
                        )}

                        {activeTab === 'about' && (
                            <div className="bg-white rounded-xl border shadow-sm p-6">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Thông tin ứng dụng</h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600">Phiên bản</span>
                                        <span className="font-medium">1.0.0</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600">Nhà phát triển</span>
                                        <span className="font-medium">JTSC</span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-gray-600">Website</span>
                                        <a href="https://jtsc.io.vn" className="font-medium text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                                            jtsc.io.vn
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
