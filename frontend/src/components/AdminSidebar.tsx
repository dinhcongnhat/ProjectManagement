import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, GitGraph, PlusCircle, LogOut, Users, X, FolderOpen } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

interface AdminSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const AdminSidebar = ({ isOpen = true, onClose }: AdminSidebarProps) => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const navItems = [
        { icon: LayoutDashboard, label: 'Tổng quan', path: '/admin' },
        { icon: CheckSquare, label: 'Quản lý dự án', path: '/admin/projects' },
        { icon: Users, label: 'Quản lý nhân viên', path: '/admin/users' },
        { icon: FolderOpen, label: 'Thư mục', path: '/admin/folders' },
        { icon: GitGraph, label: 'Quy trình', path: '/admin/workflow' },
        { icon: PlusCircle, label: 'Tạo dự án mới', path: '/admin/create-project' },
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
                    className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            <aside
                className={clsx(
                    'bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-lg transition-transform duration-300 ease-in-out',
                    'w-72',
                    isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                <div
                    className="p-4 lg:p-6 flex items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-cyan-50/50"
                    style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
                >
                    <div className="flex items-center gap-3 mt-3">
                        <img src="/Logo.png" alt="Logo" className="h-16 lg:h-18 w-auto" />
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors touch-target"
                    >
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto bg-gray-50/30 scrollbar-hide">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-4 mt-2">Menu chính</div>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/admin'}
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 px-4 py-3.5 lg:py-3 rounded-xl transition-all duration-200 group touch-target',
                                    isActive
                                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100'
                                )
                            }
                        >
                            <item.icon size={22} className={clsx("lg:w-5 lg:h-5 transition-transform group-hover:scale-110")} />
                            <span className="font-medium text-base lg:text-sm">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100 bg-white pb-safe">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3.5 lg:py-3 w-full text-left text-gray-600 hover:bg-red-50 hover:text-red-600 active:bg-red-100 rounded-xl transition-all duration-200 group touch-target"
                    >
                        <LogOut size={22} className="lg:w-5 lg:h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium text-base lg:text-sm">Đăng xuất</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default AdminSidebar;
