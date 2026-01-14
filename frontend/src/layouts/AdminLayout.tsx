import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AdminSidebar from '../components/AdminSidebar';
import Header from '../components/Header';

const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.35,
            ease: 'easeOut' as const
        }
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: {
            duration: 0.2
        }
    }
};

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const closeSidebar = () => {
        setSidebarOpen(false);
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-gray-900 overflow-hidden">
            <AdminSidebar isOpen={sidebarOpen} onClose={closeSidebar} />

            {/* Main Content */}
            <div
                className="flex-1 lg:ml-60 flex flex-col h-screen overflow-hidden transition-all duration-300"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                {/* Fixed Header */}
                <div className="shrink-0">
                    <Header onMenuClick={toggleSidebar} />
                </div>

                {/* Scrollable Content */}
                <main className="flex-1 p-4 lg:p-8 overflow-auto pb-safe">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            variants={pageVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="max-w-7xl mx-auto"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
