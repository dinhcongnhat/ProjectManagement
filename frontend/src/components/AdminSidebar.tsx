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
                    className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            <aside
                className={clsx(
                    'bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out shadow-sm',
                    'w-72 lg:w-72',
                    isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                {/* Header */}
                <div
                    className="p-4 lg:p-6 flex items-center justify-between gap-3 border-b border-gray-100 bg-white"
                    style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
                >
                    <div className="flex items-center gap-3 mt-2 justify-center w-full">
                        <img src="/Logo.png" alt="Logo" className="h-28 lg:h-22 w-auto object-contain transition-all duration-300" />
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors absolute right-4 top-6"
                    >
                        <X size={22} className="text-gray-600" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
                    <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quản lý</p>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/admin'}
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group',
                                    isActive
                                        ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm'
                                        : 'text-gray-600 border border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm hover:text-blue-600'
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <div className={clsx(
                                        'p-2 rounded-lg transition-all duration-200',
                                        isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700'
                                    )}>
                                        <item.icon size={18} />
                                    </div>
                                    <span className="text-sm font-medium">{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-3 border-t border-gray-100 pb-safe">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-3 w-full text-left text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-200 group"
                    >
                        <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-red-100 transition-colors">
                            <LogOut size={18} className="text-gray-500 group-hover:text-red-500" />
                        </div>
                        <span className="text-sm font-medium">Đăng xuất</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default AdminSidebar;
