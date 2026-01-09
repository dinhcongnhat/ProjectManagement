import { useState, useEffect, useRef } from 'react';
import { Menu, Bell } from 'lucide-react';
import ChatPopup from './ChatPopup';
import UserProfilePopup from './UserProfilePopup';
import NotificationList from './NotificationList';
import api from '../config/api';

interface HeaderProps {
    onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
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
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header
            className="h-16 border-b border-gray-200/50 flex items-center px-4 lg:px-6 sticky top-0 z-40"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
            <div className="absolute inset-0 bg-white/80 backdrop-blur-md -z-10" />
            {/* Mobile Menu Button */}
            <button
                onClick={onMenuClick}
                className="lg:hidden p-2.5 -ml-2 mr-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
                <Menu size={22} className="text-gray-700" />
            </button>

            <div className="flex items-center gap-3 flex-1">
                {/* Spacer for layout */}
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
                                className="fixed inset-0 z-[80] bg-black/20 md:bg-transparent"
                                onClick={() => setShowNotifications(false)}
                            />
                            <div className={`fixed inset-x-0 bottom-0 top-16 md:absolute md:inset-auto md:top-full md:right-0 md:mt-2 md:w-96 z-[90] md:z-[100] ${showNotifications ? 'flex flex-col' : 'hidden md:block'}`}>
                                <div className="md:hidden w-full h-full bg-white relative shadow-inner flex flex-col pt-safe">
                                    <NotificationList onClose={() => {
                                        setShowNotifications(false);
                                        api.get('/notifications/unread-count').then(res => {
                                            setUnreadCount(res.data.unreadCount);
                                        }).catch(() => { });
                                    }} />
                                </div>
                                <div className="hidden md:block">
                                    <NotificationList onClose={() => {
                                        setShowNotifications(false);
                                        api.get('/notifications/unread-count').then(res => {
                                            setUnreadCount(res.data.unreadCount);
                                        }).catch(() => { });
                                    }} />
                                </div>
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
