import { useState } from 'react';
import { Plus, Filter, MoreVertical, Calendar } from 'lucide-react';

const ProjectTasks = () => {
    const [view, setView] = useState('list'); // 'list' or 'board'
    console.log(view, setView); // Suppress unused warning for now

    const tasks = [
        { id: 1, title: 'Thiết kế Database', assignee: 'Nguyen Van A', priority: 'High', status: 'In Progress', due: '2023-12-05' },
        { id: 2, title: 'API Authentication', assignee: 'Tran Thi B', priority: 'Medium', status: 'Todo', due: '2023-12-10' },
        { id: 3, title: 'Frontend Dashboard', assignee: 'Le Van C', priority: 'High', status: 'Done', due: '2023-11-30' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Quản lý công việc</h2>
                    <p className="text-gray-500 text-sm">Dự án: Website Quản lý</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={20} />
                    <span>Thêm công việc</span>
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-200 rounded-lg text-gray-600">
                            <Filter size={20} />
                        </button>
                        <div className="h-6 w-px bg-gray-300 mx-2"></div>
                        <span className="text-sm font-medium text-gray-700">3 công việc</span>
                    </div>
                </div>

                <div className="divide-y divide-gray-100">
                    {tasks.map((task) => (
                        <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{task.title}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${task.priority === 'High' ? 'bg-red-100 text-red-700' :
                                                task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                            {task.priority}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-gray-500">
                                            <Calendar size={12} />
                                            {task.due}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-600">
                                        {task.assignee.charAt(0)}
                                    </div>
                                    <span className="text-sm text-gray-600 hidden md:block">{task.assignee}</span>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-medium w-24 text-center
                  ${task.status === 'Done' ? 'bg-green-100 text-green-700' :
                                        task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                    {task.status}
                                </div>
                                <button className="p-2 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreVertical size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectTasks;
