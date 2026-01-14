import { MoreHorizontal, Plus, Settings, GitBranch, ArrowRight } from 'lucide-react';

const Workflow = () => {
    const columns = [
        {
            id: 'todo',
            title: 'Cần làm',
            gradient: 'from-slate-500 to-gray-600',
            bgColor: 'bg-gradient-to-b from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800',
            borderColor: 'border-slate-200 dark:border-gray-700',
            items: [
                { id: 1, content: 'Nghiên cứu thị trường', tag: 'Research', tagColor: 'from-blue-500 to-cyan-500' },
                { id: 2, content: 'Phác thảo Wireframe', tag: 'Design', tagColor: 'from-pink-500 to-rose-500' },
            ]
        },
        {
            id: 'in-progress',
            title: 'Đang thực hiện',
            gradient: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
            borderColor: 'border-blue-200 dark:border-blue-800',
            items: [
                { id: 3, content: 'Thiết kế UI Homepage', tag: 'Design', tagColor: 'from-pink-500 to-rose-500' },
            ]
        },
        {
            id: 'review',
            title: 'Chờ duyệt',
            gradient: 'from-amber-500 to-orange-600',
            bgColor: 'bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
            borderColor: 'border-amber-200 dark:border-amber-800',
            items: [
                { id: 4, content: 'Database Schema', tag: 'Backend', tagColor: 'from-violet-500 to-purple-500' },
            ]
        },
        {
            id: 'done',
            title: 'Hoàn thành',
            gradient: 'from-emerald-500 to-green-600',
            bgColor: 'bg-gradient-to-b from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20',
            borderColor: 'border-emerald-200 dark:border-emerald-800',
            items: [
                { id: 5, content: 'Khởi tạo Project', tag: 'DevOps', tagColor: 'from-cyan-500 to-teal-500' },
            ]
        }
    ];

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/30">
                            <GitBranch size={24} />
                        </div>
                        Quy trình công việc
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Quản lý và theo dõi quy trình làm việc</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50">
                        <Settings size={16} />
                        Tùy chỉnh
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25">
                        <Plus size={16} />
                        Thêm cột
                    </button>
                </div>
            </div>

            {/* Workflow Columns */}
            <div className="flex-1 -mx-4 lg:mx-0">
                <div className="h-full overflow-x-auto px-4 lg:px-0 pb-4">
                    <div className="flex gap-4 lg:gap-6 h-full min-w-max lg:min-w-0">
                        {columns.map((col, colIndex) => (
                            <div key={col.id} className={`w-72 lg:w-80 flex flex-col ${col.bgColor} rounded-2xl border ${col.borderColor} max-h-full shrink-0 shadow-lg dark:shadow-gray-900/50`}>
                                {/* Column Header */}
                                <div className="p-4 flex items-center justify-between border-b border-white/50 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-t-2xl shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${col.gradient} shadow-lg`} />
                                        <h3 className="font-bold text-gray-800 dark:text-white">{col.title}</h3>
                                        <span className="bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
                                            {col.items.length}
                                        </span>
                                    </div>
                                    <button className="p-1.5 text-gray-400 hover:bg-white/80 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                        <MoreHorizontal size={18} />
                                    </button>
                                </div>

                                {/* Column Content */}
                                <div className="p-3 flex-1 overflow-y-auto space-y-3 scrollbar-hide">
                                    {col.items.map((item) => (
                                        <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 hover:shadow-xl hover:scale-[1.02] transition-all cursor-grab group">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className={`text-xs font-medium px-2.5 py-1 bg-gradient-to-r ${item.tagColor} text-white rounded-full shadow-lg`}>
                                                    {item.tag}
                                                </span>
                                                <button className="p-1 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal size={14} />
                                                </button>
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">{item.content}</p>
                                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                <div className="flex -space-x-1.5">
                                                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full border-2 border-white flex items-center justify-center text-xs text-white font-bold shadow-lg">A</div>
                                                </div>
                                                <div className="text-xs text-gray-400">2 ngày trước</div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add Card Button */}
                                    <button className="w-full py-3 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-all group">
                                        <Plus size={16} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-medium">Thêm thẻ</span>
                                    </button>
                                </div>

                                {/* Next Column Arrow */}
                                {colIndex < columns.length - 1 && (
                                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden lg:flex w-6 h-6 bg-white rounded-full shadow-lg items-center justify-center text-gray-400 z-10">
                                        <ArrowRight size={12} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Workflow;
