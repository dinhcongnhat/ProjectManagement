
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
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

const MainLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const closeSidebar = () => {
        setSidebarOpen(false);
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

            {/* Main Content */}
            <div className="flex-1 lg:ml-60 flex flex-col min-h-screen overflow-x-hidden">
                <Header onMenuClick={toggleSidebar} />
                <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto pwa-safe-bottom max-w-full">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            variants={pageVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="max-w-7xl mx-auto w-full"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
