
import { MoreHorizontal, Plus } from 'lucide-react';

const Workflow = () => {
    const columns = [
        {
            id: 'todo',
            title: 'Cần làm',
            color: 'bg-gray-100',
            items: [
                { id: 1, content: 'Nghiên cứu thị trường', tag: 'Research' },
                { id: 2, content: 'Phác thảo Wireframe', tag: 'Design' },
            ]
        },
        {
            id: 'in-progress',
            title: 'Đang thực hiện',
            color: 'bg-blue-50',
            items: [
                { id: 3, content: 'Thiết kế UI Homepage', tag: 'Design' },
            ]
        },
        {
            id: 'review',
            title: 'Chờ duyệt',
            color: 'bg-orange-50',
            items: [
                { id: 4, content: 'Database Schema', tag: 'Backend' },
            ]
        },
        {
            id: 'done',
            title: 'Hoàn thành',
            color: 'bg-green-50',
            items: [
                { id: 5, content: 'Khởi tạo Project', tag: 'DevOps' },
            ]
        }
    ];

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Quy trình công việc</h2>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                        Tùy chỉnh
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                        Thêm cột
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto">
                <div className="flex gap-6 h-full min-w-[1000px] pb-4">
                    {columns.map((col) => (
                        <div key={col.id} className="w-80 flex flex-col bg-gray-50 rounded-xl border border-gray-200 max-h-full">
                            <div className="p-4 flex items-center justify-between border-b border-gray-100 bg-white rounded-t-xl">
                                <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${col.id === 'todo' ? 'bg-gray-400' : col.id === 'in-progress' ? 'bg-blue-500' : col.id === 'review' ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                                    <h3 className="font-semibold text-gray-700">{col.title}</h3>
                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                        {col.items.length}
                                    </span>
                                </div>
                                <button className="text-gray-400 hover:text-gray-600">
                                    <MoreHorizontal size={18} />
                                </button>
                            </div>

                            <div className="p-3 flex-1 overflow-y-auto space-y-3">
                                {col.items.map((item) => (
                                    <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-move">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                                {item.tag}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-900">{item.content}</p>
                                        <div className="flex items-center justify-between mt-3">
                                            <div className="flex -space-x-2">
                                                <div className="w-6 h-6 bg-blue-100 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-blue-600 font-bold">A</div>
                                            </div>
                                            <div className="text-xs text-gray-400">2 ngày trước</div>
                                        </div>
                                    </div>
                                ))}
                                <button className="w-full py-2 flex items-center justify-center gap-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-dashed border-gray-300 transition-colors">
                                    <Plus size={16} />
                                    <span className="text-sm">Thêm thẻ</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Workflow;
