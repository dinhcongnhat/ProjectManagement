import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import * as XLSX from 'xlsx';

// Excel column headers mapping
const EXPORT_HEADERS = [
    'Mã dự án',
    'Tên dự án',
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'Thời hạn',
    'Nhóm',
    'Giá trị',
    'Phương pháp tiến độ',
    'Mô tả',
    'Tiến độ (%)',
    'Trạng thái',
    'Người quản lý',
    'Người thực hiện',
    'Người theo dõi',
    'Ngày tạo'
];

const IMPORT_HEADERS = [
    'Mã dự án (*)',
    'Tên dự án (*)',
    'Ngày bắt đầu (DD/MM/YYYY)',
    'Ngày kết thúc (DD/MM/YYYY)',
    'Thời hạn',
    'Nhóm',
    'Giá trị',
    'Phương pháp tiến độ (*)',
    'Mô tả',
    'Username người quản lý (*)',
    'Username người thực hiện (phân cách bởi dấu phẩy)',
    'Username người theo dõi (phân cách bởi dấu phẩy)'
];

// Helper to format date for Excel
const formatDateForExcel = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('vi-VN');
};

// Helper to parse date from Excel
const parseDateFromExcel = (value: any): Date | null => {
    if (!value) return null;

    // If it's already a Date object (Excel serial date)
    if (value instanceof Date) {
        return value;
    }

    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        return new Date(date.y, date.m - 1, date.d);
    }

    // If it's a string, try to parse DD/MM/YYYY format
    if (typeof value === 'string') {
        const parts = value.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
    }

    return null;
};

// Helper to get status text
const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
        'IN_PROGRESS': 'Đang thực hiện',
        'PENDING_APPROVAL': 'Chờ duyệt',
        'COMPLETED': 'Hoàn thành'
    };
    return statusMap[status] || status;
};

// Helper to parse status from text
const parseStatus = (text: string): string => {
    const statusMap: Record<string, string> = {
        'đang thực hiện': 'IN_PROGRESS',
        'chờ duyệt': 'PENDING_APPROVAL',
        'hoàn thành': 'COMPLETED'
    };
    return statusMap[text.toLowerCase().trim()] || 'IN_PROGRESS';
};

// ==================== EXPORT PROJECTS ====================

export const exportProjects = async (req: AuthRequest, res: Response) => {
    try {
        const { projectIds } = req.body; // Array of project IDs to export, empty = all
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (userRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Chỉ Admin mới có thể export dự án' });
        }

        // Build query
        const whereClause: any = {};
        if (projectIds && Array.isArray(projectIds) && projectIds.length > 0) {
            whereClause.id = { in: projectIds.map((id: any) => parseInt(id)) };
        }

        // Fetch projects
        const projects = await prisma.project.findMany({
            where: whereClause,
            include: {
                manager: { select: { username: true, name: true } },
                implementers: { select: { username: true, name: true } },
                followers: { select: { username: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (projects.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy dự án nào để export' });
        }

        // Transform data for Excel
        const excelData = projects.map(project => ({
            'Mã dự án': project.code,
            'Tên dự án': project.name,
            'Ngày bắt đầu': formatDateForExcel(project.startDate),
            'Ngày kết thúc': formatDateForExcel(project.endDate),
            'Thời hạn': project.duration || '',
            'Nhóm': project.group || '',
            'Giá trị': project.value || '',
            'Phương pháp tiến độ': project.progressMethod,
            'Mô tả': project.description || '',
            'Tiến độ (%)': project.progress,
            'Trạng thái': getStatusText(project.status),
            'Người quản lý': `${project.manager.name} (${project.manager.username})`,
            'Người thực hiện': project.implementers.map(u => `${u.name} (${u.username})`).join(', '),
            'Người theo dõi': project.followers.map(u => `${u.name} (${u.username})`).join(', '),
            'Ngày tạo': formatDateForExcel(project.createdAt)
        }));

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData, { header: EXPORT_HEADERS });

        // Set column widths
        ws['!cols'] = [
            { wch: 15 }, // Mã dự án
            { wch: 40 }, // Tên dự án
            { wch: 15 }, // Ngày bắt đầu
            { wch: 15 }, // Ngày kết thúc
            { wch: 12 }, // Thời hạn
            { wch: 15 }, // Nhóm
            { wch: 15 }, // Giá trị
            { wch: 20 }, // Phương pháp tiến độ
            { wch: 40 }, // Mô tả
            { wch: 12 }, // Tiến độ
            { wch: 15 }, // Trạng thái
            { wch: 25 }, // Người quản lý
            { wch: 40 }, // Người thực hiện
            { wch: 40 }, // Người theo dõi
            { wch: 15 }  // Ngày tạo
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Dự án');

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for download
        const filename = `DuAn_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);

        res.send(buffer);
    } catch (error) {
        console.error('[ProjectImportExport] Export error:', error);
        res.status(500).json({ message: 'Lỗi khi export dự án' });
    }
};

// ==================== DOWNLOAD IMPORT TEMPLATE ====================

export const downloadImportTemplate = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (userRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Chỉ Admin mới có thể tải file mẫu' });
        }

        // Get all users for reference
        const users = await prisma.user.findMany({
            select: { username: true, name: true, role: true }
        });

        // Create workbook with template
        const wb = XLSX.utils.book_new();

        // Main template sheet
        const templateData = [
            {
                'Mã dự án (*)': 'DA-001',
                'Tên dự án (*)': 'Dự án mẫu',
                'Ngày bắt đầu (DD/MM/YYYY)': '01/01/2025',
                'Ngày kết thúc (DD/MM/YYYY)': '31/03/2025',
                'Thời hạn': '3 tháng',
                'Nhóm': 'Nhóm A',
                'Giá trị': '100,000,000 VNĐ',
                'Phương pháp tiến độ (*)': 'Theo giai đoạn',
                'Mô tả': 'Mô tả chi tiết về dự án...',
                'Username người quản lý (*)': 'manager1',
                'Username người thực hiện (phân cách bởi dấu phẩy)': 'user1, user2',
                'Username người theo dõi (phân cách bởi dấu phẩy)': 'user3, user4'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData, { header: IMPORT_HEADERS });

        // Set column widths
        ws['!cols'] = [
            { wch: 18 }, // Mã dự án
            { wch: 35 }, // Tên dự án
            { wch: 22 }, // Ngày bắt đầu
            { wch: 22 }, // Ngày kết thúc
            { wch: 12 }, // Thời hạn
            { wch: 15 }, // Nhóm
            { wch: 20 }, // Giá trị
            { wch: 25 }, // Phương pháp tiến độ
            { wch: 40 }, // Mô tả
            { wch: 28 }, // Username người quản lý
            { wch: 45 }, // Username người thực hiện
            { wch: 45 }  // Username người theo dõi
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Mẫu Import');

        // Add users reference sheet
        const usersData = users.map(u => ({
            'Username': u.username,
            'Họ tên': u.name,
            'Vai trò': u.role === 'ADMIN' ? 'Admin' : 'Nhân viên'
        }));
        const wsUsers = XLSX.utils.json_to_sheet(usersData);
        wsUsers['!cols'] = [
            { wch: 20 },
            { wch: 30 },
            { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, wsUsers, 'Danh sách Users');

        // Add instructions sheet
        const instructions = [
            { 'Hướng dẫn': '=== HƯỚNG DẪN IMPORT DỰ ÁN ===' },
            { 'Hướng dẫn': '' },
            { 'Hướng dẫn': '1. Các cột có dấu (*) là bắt buộc phải nhập.' },
            { 'Hướng dẫn': '2. Mã dự án phải là duy nhất, không được trùng với dự án đã có.' },
            { 'Hướng dẫn': '3. Định dạng ngày: DD/MM/YYYY (ví dụ: 25/12/2025)' },
            { 'Hướng dẫn': '4. Username người quản lý phải tồn tại trong hệ thống.' },
            { 'Hướng dẫn': '5. Nhiều người thực hiện/theo dõi: nhập username phân cách bởi dấu phẩy.' },
            { 'Hướng dẫn': '' },
            { 'Hướng dẫn': '=== PHƯƠNG PHÁP TIẾN ĐỘ ===' },
            { 'Hướng dẫn': '- Theo giai đoạn' },
            { 'Hướng dẫn': '- Theo công việc' },
            { 'Hướng dẫn': '- Theo thời gian' },
            { 'Hướng dẫn': '- Thủ công' },
            { 'Hướng dẫn': '' },
            { 'Hướng dẫn': '=== LƯU Ý ===' },
            { 'Hướng dẫn': '- Xem sheet "Danh sách Users" để biết username hợp lệ.' },
            { 'Hướng dẫn': '- Xóa dòng mẫu trước khi nhập dữ liệu thực.' },
            { 'Hướng dẫn': '- File chỉ hỗ trợ định dạng .xlsx' }
        ];
        const wsInstructions = XLSX.utils.json_to_sheet(instructions);
        wsInstructions['!cols'] = [{ wch: 70 }];
        XLSX.utils.book_append_sheet(wb, wsInstructions, 'Hướng dẫn');

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Mau_Import_DuAn.xlsx"');
        res.setHeader('Content-Length', buffer.length);

        res.send(buffer);
    } catch (error) {
        console.error('[ProjectImportExport] Template download error:', error);
        res.status(500).json({ message: 'Lỗi khi tải file mẫu' });
    }
};

// ==================== IMPORT PROJECTS ====================

export const importProjects = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (userRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Chỉ Admin mới có thể import dự án' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng upload file Excel' });
        }

        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        if (rawData.length === 0) {
            return res.status(400).json({ message: 'File không có dữ liệu' });
        }

        // Get all users for validation
        const allUsers = await prisma.user.findMany({
            select: { id: true, username: true, name: true }
        });
        // Create maps for both username and name lookup (case-insensitive)
        const userByUsername = new Map(allUsers.map(u => [u.username.toLowerCase(), u.id]));
        const userByName = new Map(allUsers.map(u => [u.name.toLowerCase(), u.id]));

        // Function to find user by username or name
        const findUserId = (input: string): { id: number | null, found: boolean } => {
            const trimmed = input.trim().toLowerCase();
            if (!trimmed) return { id: null, found: false };

            // Try username first
            const byUsername = userByUsername.get(trimmed);
            if (byUsername) return { id: byUsername, found: true };

            // Try by name
            const byName = userByName.get(trimmed);
            if (byName) return { id: byName, found: true };

            return { id: null, found: false };
        };

        // Get existing project codes
        const existingProjects = await prisma.project.findMany({
            select: { code: true }
        });
        const existingCodes = new Set(existingProjects.map(p => p.code.toLowerCase()));

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        // Process each row
        for (let i = 0; i < rawData.length; i++) {
            const row: any = rawData[i];
            const rowNum = i + 2; // Excel row number (1-indexed + header)

            try {
                // Get values with flexible key matching
                const code = row['Mã dự án (*)'] || row['Mã dự án'] || '';
                const name = row['Tên dự án (*)'] || row['Tên dự án'] || '';
                const startDateStr = row['Ngày bắt đầu (DD/MM/YYYY)'] || row['Ngày bắt đầu'] || '';
                const endDateStr = row['Ngày kết thúc (DD/MM/YYYY)'] || row['Ngày kết thúc'] || '';
                const duration = row['Thời hạn'] || '';
                const group = row['Nhóm'] || '';
                const value = row['Giá trị'] || '';
                const progressMethod = row['Phương pháp tiến độ (*)'] || row['Phương pháp tiến độ'] || '';
                const description = row['Mô tả'] || '';
                const managerUsername = row['Username người quản lý (*)'] || row['Username người quản lý'] || '';
                const implementersStr = row['Username người thực hiện (phân cách bởi dấu phẩy)'] || row['Username người thực hiện'] || '';
                const followersStr = row['Username người theo dõi (phân cách bởi dấu phẩy)'] || row['Username người theo dõi'] || '';

                // Validate required fields
                if (!code.trim()) {
                    results.errors.push(`Dòng ${rowNum}: Mã dự án không được để trống`);
                    results.failed++;
                    continue;
                }

                if (!name.trim()) {
                    results.errors.push(`Dòng ${rowNum}: Tên dự án không được để trống`);
                    results.failed++;
                    continue;
                }

                if (!progressMethod.trim()) {
                    results.errors.push(`Dòng ${rowNum}: Phương pháp tiến độ không được để trống`);
                    results.failed++;
                    continue;
                }

                if (!managerUsername.trim()) {
                    results.errors.push(`Dòng ${rowNum}: Username người quản lý không được để trống`);
                    results.failed++;
                    continue;
                }

                // Check duplicate code
                if (existingCodes.has(code.toLowerCase().trim())) {
                    results.errors.push(`Dòng ${rowNum}: Mã dự án "${code}" đã tồn tại`);
                    results.failed++;
                    continue;
                }

                // Validate manager - support both username and name
                const managerResult = findUserId(managerUsername);
                if (!managerResult.found || !managerResult.id) {
                    results.errors.push(`Dòng ${rowNum}: Không tìm thấy user "${managerUsername}" (thử nhập username hoặc tên đầy đủ)`);
                    results.failed++;
                    continue;
                }
                const managerId = managerResult.id;

                // Parse implementers - support both username and name
                const implementerIds: number[] = [];
                if (implementersStr.trim()) {
                    const implementerNames = implementersStr.split(',').map((s: string) => s.trim());
                    for (const nameOrUsername of implementerNames) {
                        if (nameOrUsername) {
                            const result = findUserId(nameOrUsername);
                            if (result.found && result.id) {
                                implementerIds.push(result.id);
                            } else {
                                results.errors.push(`Dòng ${rowNum}: Không tìm thấy người thực hiện "${nameOrUsername}"`);
                            }
                        }
                    }
                }

                // Parse followers - support both username and name
                const followerIds: number[] = [];
                if (followersStr.trim()) {
                    const followerNames = followersStr.split(',').map((s: string) => s.trim());
                    for (const nameOrUsername of followerNames) {
                        if (nameOrUsername) {
                            const result = findUserId(nameOrUsername);
                            if (result.found && result.id) {
                                followerIds.push(result.id);
                            } else {
                                results.errors.push(`Dòng ${rowNum}: Không tìm thấy người theo dõi "${nameOrUsername}"`);
                            }
                        }
                    }
                }

                // Parse dates
                const startDate = parseDateFromExcel(startDateStr);
                const endDate = parseDateFromExcel(endDateStr);

                // Create project
                await prisma.project.create({
                    data: {
                        code: code.trim(),
                        name: name.trim(),
                        startDate,
                        endDate,
                        duration: duration.trim() || null,
                        group: group.trim() || null,
                        value: value.trim() || null,
                        progressMethod: progressMethod.trim(),
                        description: description.trim() || null,
                        progress: 0,
                        status: 'IN_PROGRESS',
                        managerId,
                        createdById: userId,
                        implementers: {
                            connect: implementerIds.map(id => ({ id }))
                        },
                        followers: {
                            connect: followerIds.map(id => ({ id }))
                        }
                    }
                });

                results.success++;
                existingCodes.add(code.toLowerCase().trim()); // Prevent duplicates within same import
            } catch (rowError: any) {
                console.error(`[ProjectImportExport] Error at row ${rowNum}:`, rowError);
                results.errors.push(`Dòng ${rowNum}: ${rowError.message || 'Lỗi không xác định'}`);
                results.failed++;
            }
        }

        res.json({
            message: `Import hoàn tất: ${results.success} thành công, ${results.failed} thất bại`,
            ...results
        });
    } catch (error: any) {
        console.error('[ProjectImportExport] Import error:', error);
        res.status(500).json({ message: 'Lỗi khi import dự án: ' + error.message });
    }
};

export default {
    exportProjects,
    downloadImportTemplate,
    importProjects
};
