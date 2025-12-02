import { Clock, User } from 'lucide-react';

interface ActivityHistoryPanelProps {
    projectId: number;
}

export const ActivityHistoryPanel = ({ projectId }: ActivityHistoryPanelProps) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="text-center py-16">
                <Clock size={72} className="mx-auto mb-6 text-gray-300" />
                <h3 className="text-xl font-bold text-gray-700 mb-3">Lịch sử hoạt động - Dự án #{projectId}</h3>
                <p className="text-gray-500 mb-4">Theo dõi tất cả thay đổi của dự án</p>
                <div className="inline-block px-6 py-3 bg-blue-50 text-blue-700 rounded-lg">
                    <p className="text-sm font-medium">🚧 Coming Soon: Timeline của các thay đổi, cập nhật trạng thái, và audit logs</p>
                </div>
            </div>
        </div>
    );
};
