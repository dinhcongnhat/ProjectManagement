import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, ListTodo, GitGraph, LogOut, X, FolderOpen } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/', color: 'from-blue-500 to-indigo-500' },
        { icon: CheckSquare, label: 'Quản lý công việc', path: '/projects', color: 'from-violet-500 to-purple-500' },
        { icon: ListTodo, label: 'Công việc cá nhân', path: '/my-tasks', color: 'from-cyan-500 to-blue-500' },
        { icon: FolderOpen, label: 'Thư mục', path: '/folders', color: 'from-amber-500 to-orange-500' },
        { icon: GitGraph, label: 'Quy trình', path: '/workflow', color: 'from-emerald-500 to-green-500' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleNavClick = () => {
        if (onClose && window.innerWidth < 1024) {
            onClose();
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={clsx(
                    'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out',
                    'w-72 lg:w-64',
                    isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                {/* Header */}
                <div
                    className="p-4 lg:p-5 flex items-center justify-between gap-3 border-b border-white/10"
                    style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
                >
                    <div className="flex items-center gap-3 mt-2">
                        <img src="/Logo.png" alt="Logo" className="h-14 lg:h-12 w-auto" />
                    </div>
                    {/* Close button for mobile */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <X size={22} className="text-white" />
                    </button>
                </div>

                {/* User Info */}
                <div className="px-4 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/30">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-white font-medium text-sm truncate">{user?.name || 'User'}</p>
                            <p className="text-blue-300 text-xs truncate">{user?.username || ''}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
                    <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Menu</p>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group',
                                    isActive
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <div className={clsx(
                                        'p-2 rounded-lg transition-all duration-200',
                                        isActive
                                            ? 'bg-white/20'
                                            : `bg-gradient-to-br ${item.color} opacity-80 group-hover:opacity-100`
                                    )}>
                                        <item.icon size={18} className="text-white" />
                                    </div>
                                    <span className="text-sm font-medium">{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-3 border-t border-white/10 pb-safe">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-3 w-full text-left text-gray-300 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all duration-200 group"
                    >
                        <div className="p-2 bg-red-500/20 rounded-lg group-hover:bg-red-500/30 transition-colors">
                            <LogOut size={18} className="text-red-400" />
                        </div>
                        <span className="text-sm font-medium">Đăng xuất</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
