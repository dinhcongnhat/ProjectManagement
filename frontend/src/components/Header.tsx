import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu, Bell, Briefcase, Loader2 } from 'lucide-react';
import ChatPopup from './ChatPopup';
import UserProfilePopup from './UserProfilePopup';
import NotificationList from './NotificationList';
import api from '../config/api';

interface HeaderProps {
    onMenuClick?: () => void;
}

interface ProjectResult {
    id: number;
    code: string;
    name: string;
    status: string;
}

const Header = ({ onMenuClick }: HeaderProps) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProjectResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [searching, setSearching] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const searchRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                const response = await api.get('/notifications/unread-count');
                setUnreadCount(response.data.unreadCount);
            } catch (error) {
                console.error('Error fetching unread count:', error);
            }
        };
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const searchProjects = async () => {
            setSearching(true);
            try {
                const response = await api.get('/projects', { params: { q: searchQuery } });
                setSearchResults(response.data.slice(0, 5));
                setShowResults(true);
            } catch (error) {
                console.error('Error searching projects:', error);
            } finally {
                setSearching(false);
            }
        };

        const debounce = setTimeout(searchProjects, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    const handleSelectProject = (projectId: number) => {
        setSearchQuery('');
        setShowResults(false);
        navigate(`/projects/${projectId}`);
    };

    const getStatusBadge = (status: string) => {
        const config = {
            'COMPLETED': { bg: 'bg-green-600', text: 'Hoàn thành' },
            'PENDING_APPROVAL': { bg: 'bg-amber-500', text: 'Chờ duyệt' },
            'IN_PROGRESS': { bg: 'bg-blue-600', text: 'Đang thực hiện' }
        };
        const statusConfig = config[status as keyof typeof config] || config['IN_PROGRESS'];
        return (
            <span className={`px-2 py-0.5 ${statusConfig.bg} text-white text-[10px] font-medium rounded-full`}>
                {statusConfig.text}
            </span>
        );
    };

    return (
        <header
            className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex items-center px-4 lg:px-6 sticky top-0 z-30"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
            {/* Mobile Menu Button */}
            <button
                onClick={onMenuClick}
                className="lg:hidden p-2.5 -ml-2 mr-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
                <Menu size={22} className="text-gray-700" />
            </button>

            <div className="flex items-center gap-3 flex-1">
                {/* Search */}
                <div className="hidden sm:block relative flex-1 max-w-md" ref={searchRef}>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchQuery && setShowResults(true)}
                        placeholder="Tìm kiếm dự án..."
                        className="w-full pl-11 pr-4 py-2.5 bg-gray-100 border-2 border-transparent rounded-xl focus:outline-none focus:bg-white focus:border-blue-500 transition-all text-sm"
                    />

                    {/* Search Results Dropdown */}
                    {showResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-80 overflow-y-auto z-50">
                            <div className="p-2">
                                {searchResults.map((project) => (
                                    <div
                                        key={project.id}
                                        onClick={() => handleSelectProject(project.id)}
                                        className="px-3 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 rounded-xl transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                                            <Briefcase size={18} className="text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">{project.name}</p>
                                            <p className="text-xs text-gray-500">{project.code}</p>
                                        </div>
                                        {getStatusBadge(project.status)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No results */}
                    {showResults && searchQuery && searchResults.length === 0 && !searching && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-6 text-center z-50">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Search size={20} className="text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-sm">Không tìm thấy dự án</p>
                        </div>
                    )}

                    {/* Searching */}
                    {searching && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-6 text-center z-50">
                            <Loader2 size={24} className="text-blue-500 animate-spin mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">Đang tìm kiếm...</p>
                        </div>
                    )}
                </div>

                {/* Mobile Search Icon */}
                <button className="sm:hidden p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                    <Search size={20} className="text-gray-600" />
                </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
                {/* Chat Popup */}
                <ChatPopup />

                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors relative"
                    >
                        <Bell size={20} className="text-gray-600" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification List Popup */}
                    {showNotifications && (
                        <>
                            <div
                                className="fixed inset-0 z-40 bg-black/20 md:bg-transparent"
                                onClick={() => setShowNotifications(false)}
                            />
                            <div className="fixed md:absolute inset-x-0 bottom-0 md:bottom-auto md:right-0 md:left-auto md:top-full md:mt-2 md:w-96 z-50">
                                <div className="md:hidden w-full h-1 flex justify-center pt-2 pb-1 bg-white rounded-t-2xl">
                                    <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
                                </div>
                                <NotificationList onClose={() => {
                                    setShowNotifications(false);
                                    api.get('/notifications/unread-count').then(res => {
                                        setUnreadCount(res.data.unreadCount);
                                    }).catch(() => { });
                                }} />
                            </div>
                        </>
                    )}
                </div>

                {/* User Profile */}
                <UserProfilePopup />
            </div>
        </header>
    );
};

export default Header;
