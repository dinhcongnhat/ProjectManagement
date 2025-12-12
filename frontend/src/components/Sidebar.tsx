
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, ListTodo, GitGraph, LogOut, X, FolderOpen } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: CheckSquare, label: 'Quản lý công việc', path: '/projects' },
        { icon: ListTodo, label: 'Công việc cá nhân', path: '/my-tasks' },
        { icon: FolderOpen, label: 'Thư mục', path: '/folders' },
        { icon: GitGraph, label: 'Quy trình', path: '/workflow' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleNavClick = () => {
        // Close sidebar on mobile after navigation
        if (onClose && window.innerWidth < 1024) {
            onClose();
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={clsx(
                    'bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out',
                    // Mobile styles
                    'w-72 lg:w-64',
                    // Transform for mobile
                    isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                <div className="p-4 lg:p-6 flex items-center justify-between gap-3 border-b border-gray-100 safe-top">
                    <div className="flex items-center gap-3 mt-3">
                        <img src="/Logo.png" alt="Logo" className="h-16 lg:h-18 w-auto" />
                    </div>
                    {/* Close button for mobile */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors touch-target"
                    >
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 px-4 py-3.5 lg:py-3 rounded-lg transition-colors duration-200 touch-target',
                                    isActive
                                        ? 'bg-blue-50 text-blue-600 font-medium'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
                                )
                            }
                        >
                            <item.icon size={22} className="lg:w-5 lg:h-5" />
                            <span className="text-base lg:text-sm">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100 pb-safe">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3.5 lg:py-3 w-full text-left text-gray-600 hover:bg-red-50 hover:text-red-600 active:bg-red-100 rounded-lg transition-colors duration-200 touch-target"
                    >
                        <LogOut size={22} className="lg:w-5 lg:h-5" />
                        <span className="text-base lg:text-sm">Đăng xuất</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
