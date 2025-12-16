import React, { useState, useRef } from 'react';
import {
    Upload,
    Download,
    FileSpreadsheet,
    X,
    CheckCircle,
    AlertCircle,
    Loader2,
    FileDown,
    FileUp
} from 'lucide-react';
import { API_URL } from '../config/api';

interface ImportResult {
    success: number;
    failed: number;
    errors: string[];
    message: string;
}

interface ProjectImportExportProps {
    selectedProjectIds?: number[];
    onClose: () => void;
    onSuccess?: () => void;
}

const ProjectImportExport: React.FC<ProjectImportExportProps> = ({
    selectedProjectIds = [],
    onClose,
    onSuccess
}) => {
    const [activeTab, setActiveTab] = useState<'import' | 'export'>('export');
    const [isLoading, setIsLoading] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [exportType, setExportType] = useState<'selected' | 'all'>('all');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const token = localStorage.getItem('token');

    // Download import template
    const handleDownloadTemplate = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/projects-io/template`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Không thể tải file mẫu');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Mau_Import_DuAn.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error: any) {
            console.error('Download template error:', error);
            alert('Lỗi khi tải file mẫu: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle file import
    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/projects-io/import`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const result = await response.json();
            setImportResult(result);

            if (result.success > 0 && onSuccess) {
                onSuccess();
            }
        } catch (error: any) {
            console.error('Import error:', error);
            setImportResult({
                success: 0,
                failed: 0,
                errors: [error.message],
                message: 'Lỗi khi import dự án'
            });
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle export
    const handleExport = async () => {
        setIsLoading(true);
        try {
            const body = exportType === 'selected' && selectedProjectIds.length > 0
                ? { projectIds: selectedProjectIds }
                : {};

            const response = await fetch(`${API_URL}/projects-io/export`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Không thể export dự án');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DuAn_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error: any) {
            console.error('Export error:', error);
            alert('Lỗi khi export dự án: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <FileSpreadsheet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Import / Export Dự Án
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Quản lý dự án với file Excel
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-gray-700">
                    <button
                        onClick={() => { setActiveTab('export'); setImportResult(null); }}
                        className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'export'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        <Download className="w-5 h-5" />
                        Export Dự Án
                    </button>
                    <button
                        onClick={() => { setActiveTab('import'); setImportResult(null); }}
                        className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'import'
                            ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50 dark:bg-green-900/20'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        <Upload className="w-5 h-5" />
                        Import Dự Án
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {activeTab === 'export' ? (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
                                <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                    <FileDown className="w-5 h-5" />
                                    Xuất dữ liệu dự án ra file Excel
                                </h3>
                                <p className="text-blue-600 dark:text-blue-400 text-sm">
                                    File xuất sẽ bao gồm thông tin đầy đủ của các dự án: mã, tên, ngày tháng,
                                    người phụ trách, tiến độ, trạng thái và các thông tin liên quan.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Chọn dự án để export:
                                </label>
                                <div className="space-y-2">
                                    <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${exportType === 'all'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                        }`}>
                                        <input
                                            type="radio"
                                            name="exportType"
                                            value="all"
                                            checked={exportType === 'all'}
                                            onChange={() => setExportType('all')}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                Tất cả dự án
                                            </span>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                Export toàn bộ dự án trong hệ thống
                                            </p>
                                        </div>
                                    </label>

                                    <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${exportType === 'selected'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                        } ${selectedProjectIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <input
                                            type="radio"
                                            name="exportType"
                                            value="selected"
                                            checked={exportType === 'selected'}
                                            onChange={() => setExportType('selected')}
                                            disabled={selectedProjectIds.length === 0}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <div>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                Dự án đã chọn ({selectedProjectIds.length})
                                            </span>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {selectedProjectIds.length === 0
                                                    ? 'Chưa chọn dự án nào'
                                                    : `Export ${selectedProjectIds.length} dự án đã chọn`
                                                }
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <button
                                onClick={handleExport}
                                disabled={isLoading}
                                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/25"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Đang xuất...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5" />
                                        Xuất File Excel
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
                                <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
                                    <FileUp className="w-5 h-5" />
                                    Nhập dự án từ file Excel
                                </h3>
                                <p className="text-green-600 dark:text-green-400 text-sm">
                                    Tải file mẫu, điền thông tin dự án theo hướng dẫn, sau đó upload để tạo hàng loạt dự án.
                                </p>
                            </div>

                            {/* Download Template */}
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center">
                                <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                    Bước 1: Tải file mẫu
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    File mẫu bao gồm hướng dẫn chi tiết và danh sách user
                                </p>
                                <button
                                    onClick={handleDownloadTemplate}
                                    disabled={isLoading}
                                    className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 mx-auto"
                                >
                                    <Download className="w-5 h-5" />
                                    Tải File Mẫu (.xlsx)
                                </button>
                            </div>

                            {/* Upload File */}
                            <div className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-xl p-6 text-center bg-green-50/50 dark:bg-green-900/10">
                                <Upload className="w-12 h-12 mx-auto text-green-500 mb-3" />
                                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                    Bước 2: Upload file đã điền
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    Chọn file Excel (.xlsx) chứa dữ liệu dự án
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleImport}
                                    className="hidden"
                                    id="import-file"
                                />
                                <label
                                    htmlFor="import-file"
                                    className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium cursor-pointer hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/25 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Đang xử lý...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-5 h-5" />
                                            Chọn File & Import
                                        </>
                                    )}
                                </label>
                            </div>

                            {/* Import Result */}
                            {importResult && (
                                <div className={`rounded-xl p-5 ${importResult.failed === 0 && importResult.success > 0
                                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                    : importResult.success === 0
                                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                        : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                                    }`}>
                                    <div className="flex items-start gap-3">
                                        {importResult.failed === 0 && importResult.success > 0 ? (
                                            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertCircle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${importResult.success === 0 ? 'text-red-500' : 'text-yellow-500'
                                                }`} />
                                        )}
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                                {importResult.message}
                                            </h4>
                                            <div className="flex gap-4 text-sm mb-2">
                                                <span className="text-green-600 dark:text-green-400">
                                                    ✓ Thành công: {importResult.success}
                                                </span>
                                                {importResult.failed > 0 && (
                                                    <span className="text-red-600 dark:text-red-400">
                                                        ✕ Thất bại: {importResult.failed}
                                                    </span>
                                                )}
                                            </div>
                                            {importResult.errors.length > 0 && (
                                                <div className="mt-3 max-h-32 overflow-y-auto">
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Chi tiết lỗi:
                                                    </p>
                                                    <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                                                        {importResult.errors.slice(0, 10).map((error, idx) => (
                                                            <li key={idx}>• {error}</li>
                                                        ))}
                                                        {importResult.errors.length > 10 && (
                                                            <li className="text-gray-500">
                                                                ... và {importResult.errors.length - 10} lỗi khác
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span>
                            💡 Tip: File Excel hỗ trợ định dạng .xlsx
                        </span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectImportExport;
