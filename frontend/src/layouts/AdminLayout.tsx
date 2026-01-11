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
        <div className="flex min-h-screen bg-slate-50">
            <AdminSidebar isOpen={sidebarOpen} onClose={closeSidebar} />

            {/* Main Content */}
            <div className="flex-1 lg:ml-60 flex flex-col transition-all duration-300 min-h-screen overflow-x-hidden">
                <Header onMenuClick={toggleSidebar} />
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
