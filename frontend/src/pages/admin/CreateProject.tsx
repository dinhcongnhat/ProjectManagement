import { useState } from 'react';
import { Calendar, Upload, Cloud, X, Search } from 'lucide-react';

const CreateProject = () => {
    const [activeTab, setActiveTab] = useState('general');

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-50 rounded-lg">
                    <div className="w-6 h-6 border-2 border-red-500 rounded flex items-center justify-center text-red-500 font-bold text-sm">+</div>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Tạo mới dự án</h2>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200">
                    <div className="flex gap-8 px-6">
                        <button
                            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general'
                                    ? 'border-red-500 text-red-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => setActiveTab('general')}
                        >
                            Thông tin chung
                        </button>
                        <button
                            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'advanced'
                                    ? 'border-red-500 text-red-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => setActiveTab('advanced')}
                        >
                            Nâng cao
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-3">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Mã dự án</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    defaultValue="21"
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="col-span-9">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Tên dự án <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Bắt đầu</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                        </div>
                        <div className="col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Kết thúc</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                        </div>
                        <div className="col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Thời gian</label>
                            <input
                                type="text"
                                placeholder="Ngày"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-6">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Nhóm dự án</label>
                            <select className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none">
                                <option></option>
                            </select>
                        </div>
                        <div className="col-span-6">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Tổng giá trị dự án</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Cách tính tiến độ dự án <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <select className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none">
                                <option>Theo bình quân % tiến độ các công việc thuộc dự án</option>
                            </select>
                            <X className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 cursor-pointer" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                Người quản trị <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input type="text" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Người thực hiện</label>
                            <div className="relative">
                                <input type="text" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Người theo dõi</label>
                            <div className="relative">
                                <input type="text" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Mô tả</label>
                        <textarea
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
                            placeholder="Mô tả"
                        ></textarea>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">Đính kèm</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Cloud className="text-red-500 w-6 h-6" />
                            </div>
                            <p className="text-sm text-gray-600 mb-3">Kéo thả file vào đây để tải lên hoặc</p>
                            <div className="flex justify-center gap-3">
                                <button className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded hover:bg-red-600 transition-colors flex items-center gap-2">
                                    <Upload className="w-4 h-4" /> CHỌN TỪ MÁY
                                </button>
                                <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 transition-colors flex items-center gap-2">
                                    <Cloud className="w-4 h-4" /> CHỌN TỪ CLOUD
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <button className="flex items-center gap-2 text-red-500 font-medium text-sm hover:text-red-600">
                            <span className="text-lg">›</span> Cài đặt quyền
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                    <button className="px-6 py-2 bg-red-500 text-white font-medium rounded hover:bg-red-600 transition-colors shadow-sm shadow-red-500/30">
                        CẬP NHẬT
                    </button>
                    <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors">
                        HỦY BỎ
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateProject;
