

const UserWorkflow = () => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Quy trình (Workflow)</h2>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="space-y-8">
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</div>
                        <div>
                            <h3 className="font-bold text-gray-900">Nhận việc</h3>
                            <p className="text-gray-600 mt-1">Kiểm tra tab "Công việc cá nhân" để xem các công việc được giao.</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">2</div>
                        <div>
                            <h3 className="font-bold text-gray-900">Thực hiện</h3>
                            <p className="text-gray-600 mt-1">Cập nhật trạng thái công việc thành "In Progress" khi bắt đầu làm.</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">3</div>
                        <div>
                            <h3 className="font-bold text-gray-900">Hoàn thành</h3>
                            <p className="text-gray-600 mt-1">Đánh dấu công việc là "Completed" khi đã xong.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserWorkflow;
