import { useState, useEffect, useRef } from 'react';
import { Menu, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
            className="h-16 border-b border-gray-200 bg-white flex items-center px-4 lg:px-6 sticky top-0 z-50 shadow-sm"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
            {/* Mobile Menu Button */}
            <motion.button
                onClick={onMenuClick}
                className="lg:hidden p-2.5 -ml-2 mr-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <Menu size={22} className="text-gray-700" />
            </motion.button>

            <div className="flex items-center gap-3 flex-1">
                {/* Spacer for layout */}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">


                {/* Chat Popup */}
                <ChatPopup />

                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <motion.button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors relative"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Bell size={20} className="text-gray-600" />
                        <AnimatePresence>
                            {unreadCount > 0 && (
                                <motion.span
                                    className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                >
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>

                    {/* Notification List Popup */}
                    <AnimatePresence>
                        {showNotifications && (
                            <>
                                <motion.div
                                    className="fixed inset-0 z-[80] bg-black/20 md:bg-transparent"
                                    onClick={() => setShowNotifications(false)}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                />
                                <motion.div
                                    className={`fixed inset-x-0 bottom-0 top-16 md:absolute md:inset-auto md:top-full md:right-0 md:mt-2 md:w-96 z-[90] md:z-[100] flex flex-col`}
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                >
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
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* User Profile */}
                <UserProfilePopup />
            </div>
        </header>
    );
};

export default Header;

