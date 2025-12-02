import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare } from 'lucide-react';

interface DiscussionPanelProps {
    projectId: number;
}

export const DiscussionPanelSimple = ({ projectId }: DiscussionPanelProps) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-gray-500">Đang tải...</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-center py-12">
                <MessageSquare size={64} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Thảo luận dự án</h3>
                <p className="text-gray-500">Tính năng đang được phát triển</p>
                <p className="text-sm text-gray-400 mt-2">Project ID: {projectId}, Token: {token ? 'Available' : 'Missing'}</p>
            </div>
        </div>
    );
};
