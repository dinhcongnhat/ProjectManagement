import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import Header from '../components/Header'; // Reusing Header for now, can customize later

const AdminLayout = () => {
    return (
        <div className="flex min-h-screen bg-slate-50">
            <AdminSidebar />
            <div className="flex-1 ml-72 flex flex-col transition-all duration-300">
                <Header />
                <main className="flex-1 p-8 overflow-auto">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
