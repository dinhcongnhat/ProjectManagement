import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, ListTodo, LogOut, X, FolderOpen, Columns3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
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

const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const navItems = [
        { icon: LayoutDashboard, label: 'Tổng quan', path: '/' },
        { icon: CheckSquare, label: 'Quản lý công việc', path: '/projects' },
        { icon: Columns3, label: 'Làm việc nhóm', path: '/kanban' },
        { icon: ListTodo, label: 'Công việc cá nhân', path: '/my-tasks' },
        { icon: FolderOpen, label: 'Thư mục', path: '/folders' },
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
                        className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-[55]"
                        onClick={onClose}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar - Desktop always visible */}
            <aside
                className={clsx(
                    'hidden lg:flex bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col h-screen fixed left-0 top-0 z-50 shadow-sm',
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
                        className="lg:hidden bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen fixed left-0 top-0 z-[60] shadow-lg w-60"
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
            className="p-3 lg:p-4 flex flex-col items-center gap-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}
        >
            <div className="flex items-center justify-center w-full">
                <motion.img
                    src="/Logo.png"
                    alt="Logo"
                    className="h-20 lg:h-24 w-auto object-contain"
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
                <p className="text-xs font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 dark:from-orange-400 dark:via-pink-500 dark:to-orange-400 bg-clip-text text-transparent animate-gradientShift bg-[length:200%_auto]">
                    Lắng nghe từ tâm
                </p>
                <p className="text-xs font-semibold bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 dark:from-pink-500 dark:via-orange-400 dark:to-pink-500 bg-clip-text text-transparent animate-gradientShift bg-[length:200%_auto] animation-delay-200">
                    Kiến tạo vươn tầm
                </p>
            </motion.div>

            {showCloseButton && (
                <motion.button
                    onClick={onClose}
                    className="p-3 rounded-xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-600 active:bg-gray-100 dark:active:bg-gray-500 transition-colors absolute right-3 top-3 shadow-sm"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <X size={20} className="text-gray-600 dark:text-gray-300" />
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
            <p className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Menu</p>
            {navItems.map((item, index) => (
                <motion.div
                    key={item.path}
                    variants={animate ? navItemVariants : undefined}
                    custom={index}
                >
                    <NavLink
                        to={item.path}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group',
                                isActive
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 border border-transparent hover:bg-white dark:hover:bg-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm hover:text-blue-600 dark:hover:text-blue-400'
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
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 group-hover:text-gray-700 dark:group-hover:text-gray-200'
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
        <div className="p-3 border-t border-gray-100 dark:border-gray-700 pb-safe">
            <motion.button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 w-full text-left text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all duration-200 group"
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
            >
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-red-100 dark:group-hover:bg-red-900/50 transition-colors">
                    <LogOut size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400" />
                </div>
                <span className="text-sm font-medium">Đăng xuất</span>
            </motion.button>
        </div>
    </>
);

export default Sidebar;

