
import { CheckSquare, Clock, AlertCircle } from 'lucide-react';

const MyTasks = () => {
    const myTasks = [
        { id: 1, title: 'Review Pull Request #42', project: 'Website Redesign', due: 'Today', status: 'Pending' },
        { id: 2, title: 'Update Documentation', project: 'Mobile App', due: 'Tomorrow', status: 'In Progress' },
        { id: 3, title: 'Fix Bug #128', project: 'Backend API', due: 'Overdue', status: 'Overdue' },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Công việc của tôi</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckSquare className="text-blue-600" />
                        <h3 className="font-semibold text-blue-900">Cần làm ngay</h3>
                    </div>
                    <p className="text-3xl font-bold text-blue-700">5</p>
                </div>
                <div className="bg-orange-50 p-6 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="text-orange-600" />
                        <h3 className="font-semibold text-orange-900">Đang thực hiện</h3>
                    </div>
                    <p className="text-3xl font-bold text-orange-700">3</p>
                </div>
                <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="text-red-600" />
                        <h3 className="font-semibold text-red-900">Quá hạn</h3>
                    </div>
                    <p className="text-3xl font-bold text-red-700">1</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">Danh sách công việc</h3>
                </div>
                <div className="divide-y divide-gray-100">
                    {myTasks.map((task) => (
                        <div key={task.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <div>
                                    <h4 className="font-medium text-gray-900">{task.title}</h4>
                                    <p className="text-xs text-gray-500">{task.project}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium
                  ${task.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                                        task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                    {task.due}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MyTasks;
