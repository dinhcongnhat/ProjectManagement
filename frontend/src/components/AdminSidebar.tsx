import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, GitGraph, PlusCircle, LogOut, Users } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const AdminSidebar = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const navItems = [
        { icon: LayoutDashboard, label: 'Tổng quan', path: '/admin' },
        { icon: CheckSquare, label: 'Quản lý dự án', path: '/admin/projects' },
        { icon: Users, label: 'Quản lý nhân viên', path: '/admin/users' },
        { icon: GitGraph, label: 'Quy trình', path: '/admin/workflow' },
        { icon: PlusCircle, label: 'Tạo dự án mới', path: '/admin/create-project' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-20 shadow-lg">
            <div className="p-6 flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-cyan-50/50">
                <img src="/Logo.png" alt="Logo" className="h-10 w-auto" />
                <h1 className="text-xl font-bold tracking-tight text-gray-800">Admin<span className="text-blue-600">Portal</span></h1>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto bg-gray-50/30">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-4 mt-2">Menu chính</div>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/admin'}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                                isActive
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                            )
                        }
                    >
                        <item.icon size={20} className={clsx("transition-transform group-hover:scale-110")} />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-100 bg-white">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full text-left text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-200 group"
                >
                    <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium">Đăng xuất</span>
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
