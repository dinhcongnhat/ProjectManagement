import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { User, Settings, LogOut } from 'lucide-react';

interface UserProfileData {
    id: number;
    username: string;
    name: string;
    role: string;
    position: string | null;
    avatar: string | null;
    avatarUrl: string | null;
}

export default function UserProfilePopup() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Fetch profile
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/users/profile');
                setProfile(response.data);
            } catch (error) {
                console.error('Error fetching profile:', error);
            }
        };
        fetchProfile();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleProfileClick = () => {
        setIsOpen(false);
        navigate('/profile');
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <div className="relative" ref={popupRef}>
            {/* User Avatar Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
                {profile?.avatarUrl ? (
                    <img
                        src={profile.avatarUrl}
                        alt={profile.name}
                        className="w-9 h-9 rounded-full object-cover border-2 border-gray-200"
                    />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm border-2 border-gray-200">
                        {profile?.name ? getInitials(profile.name) : <User size={18} />}
                    </div>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                    {/* User Info */}
                    <div className="p-4 border-b bg-gray-50">
                        <div className="flex items-center gap-3">
                            {profile?.avatarUrl ? (
                                <img
                                    src={profile.avatarUrl}
                                    alt={profile.name}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                                    {profile?.name ? getInitials(profile.name) : <User size={24} />}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 truncate">
                                    {profile?.name || user?.name || 'User'}
                                </h4>
                                <p className="text-sm text-gray-500 truncate">
                                    {profile?.position || profile?.role || ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                        <button
                            onClick={handleProfileClick}
                            className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <User size={20} className="text-gray-500" />
                            <span>Hồ sơ cá nhân</span>
                        </button>
                        
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                // Navigate to settings if you have one
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Settings size={20} className="text-gray-500" />
                            <span>Cài đặt</span>
                        </button>
                    </div>

                    {/* Logout */}
                    <div className="border-t py-2">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <LogOut size={20} />
                            <span>Đăng xuất</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
