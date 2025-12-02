import { MessageSquare } from 'lucide-react';

interface DiscussionPanelProps {
    projectId: number;
}

export const DiscussionPanel = ({ projectId }: DiscussionPanelProps) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="text-center py-16">
                <MessageSquare size={72} className="mx-auto mb-6 text-gray-300" />
                <h3 className="text-xl font-bold text-gray-700 mb-3">Thảo luận dự án #{projectId}</h3>
                <p className="text-gray-500 mb-4">Tính năng thảo luận đang được phát triển...</p>
                <div className="inline-block px-6 py-3 bg-red-50 text-red-700 rounded-lg">
                    <p className="text-sm font-medium">🚧 Coming Soon: Real-time messaging, file sharing, và emoji reactions</p>
                </div>
            </div>
        </div>
    );
};
