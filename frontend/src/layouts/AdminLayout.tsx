import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import Header from '../components/Header';

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
            <div className="flex-1 lg:ml-72 flex flex-col transition-all duration-300 min-h-screen">
                <Header onMenuClick={toggleSidebar} />
                <main className="flex-1 p-4 lg:p-8 overflow-auto pb-safe">
                    <div className="max-w-7xl mx-auto fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
