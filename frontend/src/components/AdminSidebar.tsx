import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, GitGraph, LogOut, Users, X, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

interface AdminSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const sidebarVariants = {
    hidden: { x: '-100%' },
    visible: {
        x: 0,
        transition: {
            type: 'spring' as const,
            stiffness: 300,
            damping: 30
        }
    },
    exit: {
        x: '-100%',
        transition: {
            type: 'spring' as const,
            stiffness: 300,
            damping: 30
        }
    }
};

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
};

const navItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            type: 'spring' as const,
            stiffness: 300,
            damping: 24
        }
    }
};

const staggerContainer = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    }
};

const AdminSidebar = ({ isOpen = true, onClose }: AdminSidebarProps) => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const navItems = [
        { icon: LayoutDashboard, label: 'Tổng quan', path: '/admin' },
        { icon: CheckSquare, label: 'Quản lý dự án', path: '/admin/projects' },
        { icon: Users, label: 'Quản lý nhân viên', path: '/admin/users' },
        { icon: FolderOpen, label: 'Thư mục', path: '/admin/folders' },
        { icon: GitGraph, label: 'Quy trình', path: '/admin/workflow' },
        { icon: CheckSquare, label: 'Công việc cá nhân', path: '/admin/my-tasks' },
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
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.2 }}
                        className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                        onClick={onClose}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar - Desktop always visible */}
            <aside
                className={clsx(
                    'hidden lg:flex bg-white border-r border-gray-200 flex-col h-screen fixed left-0 top-0 z-50 shadow-sm',
                    'w-60'
                )}
            >
                <SidebarContent
                    navItems={navItems}
                    handleNavClick={handleNavClick}
                    handleLogout={handleLogout}
                    onClose={onClose}
                    showCloseButton={false}
                />
            </aside>

            {/* Sidebar - Mobile animated */}
            <AnimatePresence>
                {isOpen && (
                    <motion.aside
                        variants={sidebarVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="lg:hidden bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-lg w-60"
                    >
                        <SidebarContent
                            navItems={navItems}
                            handleNavClick={handleNavClick}
                            handleLogout={handleLogout}
                            onClose={onClose}
                            showCloseButton={true}
                            animate={true}
                        />
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
};

interface SidebarContentProps {
    navItems: { icon: React.ComponentType<{ size?: number }>; label: string; path: string }[];
    handleNavClick: () => void;
    handleLogout: () => void;
    onClose?: () => void;
    showCloseButton: boolean;
    animate?: boolean;
}

const SidebarContent = ({
    navItems,
    handleNavClick,
    handleLogout,
    onClose,
    showCloseButton,
    animate = false
}: SidebarContentProps) => (
    <>
        {/* Header */}
        <div
            className="p-3 lg:p-4 flex flex-col items-center gap-2 border-b border-gray-100 bg-gradient-to-br from-white to-blue-50/30"
            style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
        >
            <div className="flex items-center justify-center w-full">
                <motion.img
                    src="/Logo.png"
                    alt="Logo"
                    className="h-16 lg:h-16 w-auto object-contain"
                    initial={animate ? { scale: 0.8, opacity: 0 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
                />
            </div>

            {/* Animated Slogan */}
            <motion.div
                className="w-full text-center space-y-0.5"
                initial={animate ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <p className="text-xs font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent animate-gradientShift bg-[length:200%_auto]">
                    Lắng nghe từ tâm
                </p>
                <p className="text-xs font-semibold bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent animate-gradientShift bg-[length:200%_auto] animation-delay-200">
                    Kiến tạo vươn tầm
                </p>
            </motion.div>

            {showCloseButton && (
                <motion.button
                    onClick={onClose}
                    className="p-2 rounded-xl bg-white/80 backdrop-blur-sm hover:bg-white transition-colors absolute right-3 top-3 shadow-sm"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <X size={20} className="text-gray-600" />
                </motion.button>
            )}
        </div>

        {/* Navigation */}
        <motion.nav
            className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide"
            variants={animate ? staggerContainer : undefined}
            initial={animate ? "hidden" : false}
            animate="visible"
        >
            <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quản lý</p>
            {navItems.map((item, index) => (
                <motion.div
                    key={item.path}
                    variants={animate ? navItemVariants : undefined}
                    custom={index}
                >
                    <NavLink
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
                                <motion.div
                                    className={clsx(
                                        'p-2 rounded-lg transition-all duration-200',
                                        isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700'
                                    )}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <item.icon size={18} />
                                </motion.div>
                                <span className="text-sm font-medium">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                </motion.div>
            ))}
        </motion.nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 pb-safe">
            <motion.button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 w-full text-left text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-200 group"
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
            >
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-red-100 transition-colors">
                    <LogOut size={18} className="text-gray-500 group-hover:text-red-500" />
                </div>
                <span className="text-sm font-medium">Đăng xuất</span>
            </motion.button>
        </div>
    </>
);

export default AdminSidebar;

