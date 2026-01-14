import { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Check, Loader2, CheckSquare, Square, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

interface SubProject {
    id: number;
    code: string;
    name: string;
    description?: string;
    documentNumber?: string;
    documentDate?: string;
    implementingUnit?: string;
    appraisalUnit?: string;
    approver?: string;
    startDate?: string;
    endDate?: string;
    productType?: string;
    value?: string;
    priority?: 'NORMAL' | 'HIGH';
    manager?: { id: number; name: string };
    implementers?: { id: number; name: string }[];
    cooperators?: { id: number; name: string }[];
}

interface ExportSubProjectsModalProps {
    isOpen: boolean;
    onClose: () => void;
    parentProjectCode: string;
    parentProjectName: string;
    subProjects: SubProject[];
}

export const ExportSubProjectsModal = ({
    isOpen,
    onClose,
    parentProjectCode,
    parentProjectName,
    subProjects
}: ExportSubProjectsModalProps) => {
    const { token } = useAuth();
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [exportMode, setExportMode] = useState<'all' | 'selected'>('all');
    const [fullSubProjects, setFullSubProjects] = useState<SubProject[]>([]);

    // Fetch full sub-project data when modal opens
    useEffect(() => {
        if (isOpen && subProjects.length > 0) {
            setIsLoading(true);
            const fetchFullData = async () => {
                try {
                    const fullData = await Promise.all(
                        subProjects.map(async (sp) => {
                            const response = await fetch(`${API_URL}/projects/${sp.id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            if (response.ok) {
                                return response.json();
                            }
                            return sp;
                        })
                    );
                    setFullSubProjects(fullData);
                    setSelectedIds(new Set(fullData.map((p: SubProject) => p.id)));
                } catch (error) {
                    console.error('Error fetching sub-project details:', error);
                    setFullSubProjects(subProjects);
                    setSelectedIds(new Set(subProjects.map(p => p.id)));
                } finally {
                    setIsLoading(false);
                }
            };
            fetchFullData();
        }
    }, [isOpen, subProjects, token]);

    if (!isOpen) return null;

    const handleSelectAll = () => {
        if (selectedIds.size === fullSubProjects.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(fullSubProjects.map(p => p.id)));
        }
    };

    const handleToggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('vi-VN');
        } catch {
            return '';
        }
    };

    const formatCurrency = (value?: string) => {
        if (!value) return '';
        return value.replace(/[^\d]/g, '');
    };

    const handleExport = async () => {
        setIsExporting(true);

        try {
            // Filter sub-projects based on export mode
            const projectsToExport = exportMode === 'all'
                ? fullSubProjects
                : fullSubProjects.filter(p => selectedIds.has(p.id));

            if (projectsToExport.length === 0) {
                alert('Vui lòng chọn ít nhất một dự án con để xuất');
                setIsExporting(false);
                return;
            }

            // Transform data to match import template columns
            const exportData = projectsToExport.map(project => ({
                'Mã dự án con': project.code,
                'Tên công việc': project.name,
                'Mô tả': project.description || '',
                'Số hiệu văn bản': project.documentNumber || '',
                'Ngày văn bản': formatDate(project.documentDate),
                'Đơn vị thực hiện': project.implementingUnit || '',
                'Đơn vị thẩm định': project.appraisalUnit || '',
                'Người phê duyệt': project.approver || '',
                'Ngày bắt đầu': formatDate(project.startDate),
                'Ngày kết thúc': formatDate(project.endDate),
                'Loại sản phẩm': project.productType || '',
                'Giá trị (VNĐ)': formatCurrency(project.value),
                'Mức độ ưu tiên': project.priority === 'HIGH' ? 'Ưu tiên cao' : 'Bình thường',
                'Người quản lý': project.manager?.name || '',
                'Người thực hiện': project.implementers?.map(u => u.name).join(', ') || '',
                'Người phối hợp': project.cooperators?.map(u => u.name).join(', ') || ''
            }));

            // Create workbook and worksheet
            const worksheet = XLSX.utils.json_to_sheet(exportData);

            // Set column widths
            worksheet['!cols'] = [
                { wch: 15 },  // Mã dự án con
                { wch: 40 },  // Tên công việc
                { wch: 50 },  // Mô tả
                { wch: 18 },  // Số hiệu văn bản
                { wch: 15 },  // Ngày văn bản
                { wch: 20 },  // Đơn vị thực hiện
                { wch: 20 },  // Đơn vị thẩm định
                { wch: 20 },  // Người phê duyệt
                { wch: 15 },  // Ngày bắt đầu
                { wch: 15 },  // Ngày kết thúc
                { wch: 20 },  // Loại sản phẩm
                { wch: 18 },  // Giá trị
                { wch: 15 },  // Mức độ ưu tiên
                { wch: 25 },  // Người quản lý
                { wch: 35 },  // Người thực hiện
                { wch: 35 },  // Người phối hợp
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách dự án con');

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `${parentProjectCode}_DuAnCon_${timestamp}.xlsx`;

            // Download file
            XLSX.writeFile(workbook, filename);

            setTimeout(() => {
                setIsExporting(false);
                onClose();
            }, 500);
        } catch (error) {
            console.error('Export error:', error);
            alert('Có lỗi khi xuất file. Vui lòng thử lại.');
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl">
                                <FileSpreadsheet size={24} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Xuất danh sách dự án con</h2>
                                <p className="text-white/80 text-sm mt-0.5">
                                    {parentProjectName}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                        >
                            <X size={20} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Export Mode Selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            <Filter size={16} className="inline mr-2" />
                            Tùy chọn xuất
                        </label>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setExportMode('all')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${exportMode === 'all'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                    }`}
                            >
                                <CheckSquare size={18} />
                                <span className="font-medium">Xuất tất cả ({fullSubProjects.length})</span>
                            </button>
                            <button
                                onClick={() => setExportMode('selected')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${exportMode === 'selected'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                    }`}
                            >
                                <Square size={18} />
                                <span className="font-medium">Chọn dự án ({selectedIds.size})</span>
                            </button>
                        </div>
                    </div>

                    {/* Sub-project selection list (only show when 'selected' mode) */}
                    {exportMode === 'selected' && (
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-semibold text-gray-700">
                                    Chọn dự án con để xuất
                                </label>
                                <button
                                    onClick={handleSelectAll}
                                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    {selectedIds.size === fullSubProjects.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                </button>
                            </div>
                            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl">
                                {isLoading ? (
                                    <div className="p-6 text-center text-gray-500">
                                        <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                                        Đang tải dữ liệu...
                                    </div>
                                ) : fullSubProjects.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">
                                        Chưa có dự án con nào
                                    </div>
                                ) : (
                                    fullSubProjects.map((project, index) => (
                                        <div
                                            key={project.id}
                                            onClick={() => handleToggleSelect(project.id)}
                                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${index !== 0 ? 'border-t border-gray-100' : ''
                                                } ${selectedIds.has(project.id) ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.has(project.id)
                                                ? 'bg-emerald-500 border-emerald-500'
                                                : 'border-gray-300'
                                                }`}>
                                                {selectedIds.has(project.id) && (
                                                    <Check size={14} className="text-white" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 truncate">{project.name}</p>
                                                <p className="text-xs text-gray-500">{project.code}</p>
                                            </div>
                                            {project.manager && (
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                                    {project.manager.name}
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Export info */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                        <h4 className="font-semibold text-gray-900 mb-2">Thông tin xuất:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Số dự án con sẽ xuất: <strong>{exportMode === 'all' ? fullSubProjects.length : selectedIds.size}</strong></li>
                            <li>• Định dạng file: <strong>Excel (.xlsx)</strong></li>
                            <li>• Các cột dữ liệu tương thích với file Import</li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting || isLoading || (exportMode === 'selected' && selectedIds.size === 0)}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-500/25"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Đang xuất...
                                </>
                            ) : (
                                <>
                                    <Download size={18} />
                                    Xuất Excel
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
