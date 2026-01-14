import { useState, useRef } from 'react';
import { X, Download, Upload, FileSpreadsheet, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import * as XLSX from 'xlsx';

interface ImportSubProjectsModalProps {
    isOpen: boolean;
    onClose: () => void;
    parentProjectId: number;
    parentProjectCode: string;
    onImportSuccess: () => void;
    users: { id: number; name: string; role: string }[];
}

interface SubProjectRow {
    name: string;
    description: string;
    documentNumber: string;
    documentDate: string;
    implementingUnit: string;
    appraisalUnit: string;
    approver: string;
    startDate: string;
    endDate: string;
    duration: string;
    productType: string;
    value: string;
    priority: string;
    managerName: string;
    implementerNames: string;
    cooperatorNames: string;
}

interface ParsedSubProject extends SubProjectRow {
    valid: boolean;
    errors: string[];
    managerId?: number;
    implementerIds?: number[];
    cooperatorIds?: number[];
}

export const ImportSubProjectsModal = ({
    isOpen,
    onClose,
    parentProjectId,
    parentProjectCode,
    onImportSuccess,
    users
}: ImportSubProjectsModalProps) => {
    const { token } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [parsedData, setParsedData] = useState<ParsedSubProject[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

    // Download Excel template
    const downloadTemplate = () => {
        const templateData = [
            {
                'Tên công việc': 'Khảo sát địa hình khu vực A',
                'Mô tả': 'Thực hiện khảo sát địa hình chi tiết khu vực A',
                'Số hiệu văn bản': 'VB-2026-001',
                'Ngày văn bản': '15/01/2026',
                'Đơn vị thực hiện': 'Phòng Kỹ thuật',
                'Đơn vị thẩm định': 'Phòng Giám sát',
                'Người phê duyệt': 'Nguyễn Văn A',
                'Ngày bắt đầu': '20/01/2026',
                'Ngày kết thúc': '28/02/2026',
                'Loại sản phẩm': 'Báo cáo khảo sát',
                'Giá trị (VNĐ)': '50000000',
                'Mức độ ưu tiên': 'Bình thường',
                'Người quản lý': 'Đinh Công Nhất',
                'Người thực hiện': 'Nguyễn Văn B, Trần Văn C',
                'Người phối hợp': 'Lê Thị D'
            },
            {
                'Tên công việc': 'Thiết kế bản vẽ kỹ thuật',
                'Mô tả': 'Thiết kế bản vẽ kỹ thuật cho công trình',
                'Số hiệu văn bản': 'VB-2026-002',
                'Ngày văn bản': '18/01/2026',
                'Đơn vị thực hiện': 'Phòng Thiết kế',
                'Đơn vị thẩm định': 'Phòng Chất lượng',
                'Người phê duyệt': 'Trần Văn B',
                'Ngày bắt đầu': '01/03/2026',
                'Ngày kết thúc': '30/04/2026',
                'Loại sản phẩm': 'Bản vẽ AutoCAD',
                'Giá trị (VNĐ)': '150000000',
                'Mức độ ưu tiên': 'Ưu tiên cao',
                'Người quản lý': 'Đinh Công Nhất',
                'Người thực hiện': 'Phạm Văn E',
                'Người phối hợp': 'Hoàng Văn F, Vũ Thị G'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);

        // Set column widths
        worksheet['!cols'] = [
            { wch: 30 }, // Tên công việc
            { wch: 40 }, // Mô tả
            { wch: 18 }, // Số hiệu văn bản
            { wch: 14 }, // Ngày văn bản
            { wch: 20 }, // Đơn vị thực hiện
            { wch: 20 }, // Đơn vị thẩm định
            { wch: 18 }, // Người phê duyệt
            { wch: 14 }, // Ngày bắt đầu
            { wch: 14 }, // Ngày kết thúc
            { wch: 20 }, // Loại sản phẩm
            { wch: 15 }, // Giá trị
            { wch: 16 }, // Mức độ ưu tiên
            { wch: 20 }, // Người quản lý
            { wch: 30 }, // Người thực hiện
            { wch: 25 }, // Người phối hợp
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Dự án con');

        XLSX.writeFile(workbook, `Mau_Import_DuAnCon_${parentProjectCode}.xlsx`);
    };

    // Parse date from various formats
    const parseDate = (dateStr: string): string => {
        if (!dateStr) return '';

        // Handle DD/MM/YYYY format
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Handle Excel serial date
        if (!isNaN(Number(dateStr))) {
            const excelDate = XLSX.SSF.parse_date_code(Number(dateStr));
            if (excelDate) {
                return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
            }
        }

        return dateStr;
    };

    // Find user by name (partial match)
    const findUserByName = (name: string): { id: number; name: string } | undefined => {
        if (!name) return undefined;
        const trimmedName = name.trim().toLowerCase();
        return users.find(u => u.name.toLowerCase().includes(trimmedName) || trimmedName.includes(u.name.toLowerCase()));
    };

    // Parse uploaded Excel file
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

                const parsed: ParsedSubProject[] = jsonData.map((row, index) => {
                    const errors: string[] = [];

                    // Get values from row
                    const name = String(row['Tên công việc'] || '').trim();
                    const description = String(row['Mô tả'] || '').trim();
                    const documentNumber = String(row['Số hiệu văn bản'] || '').trim();
                    const documentDate = parseDate(String(row['Ngày văn bản'] || ''));
                    const implementingUnit = String(row['Đơn vị thực hiện'] || '').trim();
                    const appraisalUnit = String(row['Đơn vị thẩm định'] || '').trim();
                    const approver = String(row['Người phê duyệt'] || '').trim();
                    const startDate = parseDate(String(row['Ngày bắt đầu'] || ''));
                    const endDate = parseDate(String(row['Ngày kết thúc'] || ''));
                    const productType = String(row['Loại sản phẩm'] || '').trim();
                    const value = String(row['Giá trị (VNĐ)'] || '').replace(/[^\d]/g, '');
                    const priorityRaw = String(row['Mức độ ưu tiên'] || '').trim();
                    const priority = priorityRaw.toLowerCase().includes('ưu tiên cao') || priorityRaw.toLowerCase().includes('high') ? 'HIGH' : 'NORMAL';
                    const managerName = String(row['Người quản lý'] || '').trim();
                    const implementerNames = String(row['Người thực hiện'] || '').trim();
                    const cooperatorNames = String(row['Người phối hợp'] || '').trim();

                    // Calculate duration
                    let duration = '';
                    if (startDate && endDate) {
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        const diffTime = Math.abs(end.getTime() - start.getTime());
                        duration = String(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                    }

                    // Validate required fields
                    if (!name) errors.push(`Dòng ${index + 2}: Thiếu tên công việc`);
                    if (!managerName) errors.push(`Dòng ${index + 2}: Thiếu người quản lý`);

                    // Find manager
                    const manager = findUserByName(managerName);
                    if (managerName && !manager) {
                        errors.push(`Dòng ${index + 2}: Không tìm thấy người quản lý "${managerName}"`);
                    }

                    // Find implementers
                    const implementerIds: number[] = [];
                    if (implementerNames) {
                        implementerNames.split(',').forEach(name => {
                            const user = findUserByName(name.trim());
                            if (user) {
                                implementerIds.push(user.id);
                            }
                        });
                    }

                    // Find cooperators
                    const cooperatorIds: number[] = [];
                    if (cooperatorNames) {
                        cooperatorNames.split(',').forEach(name => {
                            const user = findUserByName(name.trim());
                            if (user) {
                                cooperatorIds.push(user.id);
                            }
                        });
                    }

                    return {
                        name,
                        description,
                        documentNumber,
                        documentDate,
                        implementingUnit,
                        appraisalUnit,
                        approver,
                        startDate,
                        endDate,
                        duration,
                        productType,
                        value,
                        priority,
                        managerName,
                        implementerNames,
                        cooperatorNames,
                        valid: errors.length === 0,
                        errors,
                        managerId: manager?.id,
                        implementerIds,
                        cooperatorIds
                    };
                });

                setParsedData(parsed);
                setImportResult(null);
            } catch (error) {
                console.error('Error parsing Excel:', error);
                alert('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng file.');
            }
        };
        reader.readAsArrayBuffer(file);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Import all valid data
    const handleImport = async () => {
        const validItems = parsedData.filter(item => item.valid);
        if (validItems.length === 0) {
            alert('Không có dữ liệu hợp lệ để import');
            return;
        }

        setIsImporting(true);
        setImportProgress(0);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];

            try {
                // Generate code for sub-project
                const childIndex = i + 1;
                const projectCode = `${parentProjectCode}.${String(childIndex).padStart(2, '0')}`;

                const projectData = {
                    code: projectCode,
                    name: item.name,
                    description: item.description,
                    documentNumber: item.documentNumber,
                    documentDate: item.documentDate || null,
                    implementingUnit: item.implementingUnit,
                    appraisalUnit: item.appraisalUnit,
                    approver: item.approver,
                    startDate: item.startDate,
                    endDate: item.endDate,
                    duration: item.duration,
                    productType: item.productType,
                    value: item.value,
                    priority: item.priority,
                    parentId: parentProjectId,
                    managerId: item.managerId,
                    implementerIds: JSON.stringify(item.implementerIds || []),
                    cooperatorIds: JSON.stringify(item.cooperatorIds || [])
                };

                const response = await fetch(`${API_URL}/projects/sub-project`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(projectData)
                });

                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error('Error creating sub-project:', error);
                failCount++;
            }

            setImportProgress(Math.round(((i + 1) / validItems.length) * 100));
        }

        setImportResult({ success: successCount, failed: failCount });
        setIsImporting(false);

        if (successCount > 0) {
            onImportSuccess();
        }
    };

    const handleClose = () => {
        setParsedData([]);
        setImportResult(null);
        setImportProgress(0);
        onClose();
    };

    if (!isOpen) return null;

    const validCount = parsedData.filter(p => p.valid).length;
    const invalidCount = parsedData.filter(p => !p.valid).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-cyan-600 to-blue-600">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <FileSpreadsheet size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Import Dự án con từ Excel</h2>
                            <p className="text-cyan-100 text-sm">Dự án: {parentProjectCode}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={22} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Step 1: Download Template */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            Tải file mẫu
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Tải về file mẫu Excel để điền thông tin các dự án con. File mẫu đã có 2 dự án mẫu để bạn tham khảo.
                        </p>
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
                        >
                            <Download size={18} />
                            Tải file mẫu Excel
                        </button>
                    </div>

                    {/* Step 2: Upload File */}
                    <div className="bg-green-50 border border-green-100 rounded-xl p-5">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            Tải lên file Excel
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Sau khi điền xong thông tin, tải lên file Excel để xem trước và import.
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.xlsm"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
                        >
                            <Upload size={18} />
                            Chọn file Excel
                        </button>
                    </div>

                    {/* Preview Data */}
                    {parsedData.length > 0 && (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                            <div className="bg-gray-50 dark:bg-gray-900/50 px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                                    Xem trước dữ liệu ({parsedData.length} dự án)
                                </h3>
                                <div className="flex items-center gap-4">
                                    {validCount > 0 && (
                                        <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                                            <Check size={16} />
                                            {validCount} hợp lệ
                                        </span>
                                    )}
                                    {invalidCount > 0 && (
                                        <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                                            <AlertCircle size={16} />
                                            {invalidCount} lỗi
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300 w-10">TT</th>
                                            <th className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300">Tên công việc</th>
                                            <th className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300">Người quản lý</th>
                                            <th className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300">Thời gian</th>
                                            <th className="px-4 py-2.5 text-center font-semibold text-gray-700 dark:text-gray-300 w-24">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedData.map((item, index) => (
                                            <tr key={index} className={`border-t border-gray-200 dark:border-gray-700 ${item.valid ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{index + 1}</td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">{item.name || '-'}</p>
                                                    {item.errors.length > 0 && (
                                                        <p className="text-xs text-red-500 mt-1">{item.errors.join(', ')}</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.managerName || '-'}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                                                    {item.startDate && item.endDate ? (
                                                        <span>{new Date(item.startDate).toLocaleDateString('vi-VN')} - {new Date(item.endDate).toLocaleDateString('vi-VN')}</span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {item.valid ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                                                            <Check size={12} />
                                                            Hợp lệ
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                                                            <AlertCircle size={12} />
                                                            Lỗi
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Import Progress */}
                    {isImporting && (
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <Loader2 size={20} className="text-blue-600 animate-spin" />
                                <span className="font-medium text-blue-700 dark:text-blue-300">Đang import... {importProgress}%</span>
                            </div>
                            <div className="w-full bg-blue-200 dark:bg-blue-900/30 rounded-full h-2.5">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${importProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Import Result */}
                    {importResult && (
                        <div className={`rounded-xl p-5 ${importResult.failed > 0 ? 'bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30' : 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30'}`}>
                            <div className="flex items-center gap-3">
                                {importResult.failed === 0 ? (
                                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                        <Check size={24} className="text-white" />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                                        <AlertCircle size={24} className="text-white" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {importResult.failed === 0 ? 'Import thành công!' : 'Import hoàn tất với một số lỗi'}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Thành công: <span className="text-green-600 dark:text-green-400 font-semibold">{importResult.success}</span>
                                        {importResult.failed > 0 && (
                                            <> | Thất bại: <span className="text-red-600 dark:text-red-400 font-semibold">{importResult.failed}</span></>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {parsedData.length > 0 && `${validCount} dự án sẵn sàng import`}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            {importResult ? 'Đóng' : 'Hủy'}
                        </button>
                        {!importResult && validCount > 0 && (
                            <button
                                onClick={handleImport}
                                disabled={isImporting}
                                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium rounded-xl hover:from-cyan-700 hover:to-blue-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Đang import...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        Import {validCount} dự án
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
