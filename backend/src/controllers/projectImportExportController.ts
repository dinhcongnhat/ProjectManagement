import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import * as XLSX from 'xlsx';
import { ProjectStatus, WorkflowStatus, ProjectPriority } from '@prisma/client';

// Excel column headers mapping
const EXPORT_HEADERS = [
    'Mã dự án',
    'Tên dự án',
    'Chủ đầu tư',
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'Thời hạn',
    'Nhóm',
    'Giá trị',
    'Mô tả',
    'Mức độ ưu tiên',
    'Trạng thái',
    'Người quản lý',
    'Người thực hiện',
    'Người phối hợp',
    'Ngày tạo'
];

const IMPORT_HEADERS = [
    'Mã dự án',
    'Tên dự án',
    'Chủ đầu tư',
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'Thời hạn',
    'Nhóm',
    'Giá trị',
    'Mô tả',
    'Mức độ ưu tiên',
    'Trạng thái',
    'Người quản lý',
    'Người thực hiện',
    'Người phối hợp'
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
            const day = parseInt(parts[0] as string, 10);
            const month = parseInt(parts[1] as string, 10) - 1;
            const year = parseInt(parts[2] as string, 10);
            return new Date(year, month, day);
        }
    }

    return null;
};

// Helper to get status text
const getStatusText = (status: string | ProjectStatus): string => {
    const statusMap: Record<string, string> = {
        [ProjectStatus.IN_PROGRESS]: 'Đang thực hiện',
        [ProjectStatus.PENDING_APPROVAL]: 'Chờ duyệt',
        [ProjectStatus.COMPLETED]: 'Hoàn thành'
    };
    return statusMap[status as string] || (status as string);
};

// Helper to get priority text
const getPriorityText = (priority: string | ProjectPriority): string => {
    const priorityMap: Record<string, string> = {
        [ProjectPriority.HIGH]: 'Cao',
        [ProjectPriority.NORMAL]: 'Thường'
    };
    return priorityMap[priority as string] || 'Thường';
};

// Helper to parse status from text
const parseStatus = (text: string): ProjectStatus => {
    const statusMap: Record<string, ProjectStatus> = {
        'đang thực hiện': ProjectStatus.IN_PROGRESS,
        'chờ duyệt': ProjectStatus.PENDING_APPROVAL,
        'hoàn thành': ProjectStatus.COMPLETED,
        'in_progress': ProjectStatus.IN_PROGRESS,
        'pending_approval': ProjectStatus.PENDING_APPROVAL,
        'completed': ProjectStatus.COMPLETED
    };
    return statusMap[text.toLowerCase().trim()] || ProjectStatus.IN_PROGRESS;
};

// Helper to parse priority from text
const parsePriority = (text: string): ProjectPriority => {
    const lowerText = text.toLowerCase().trim();
    if (['cao', 'gấp', 'high', 'priority', 'ưu tiên'].includes(lowerText)) {
        return ProjectPriority.HIGH;
    }
    return ProjectPriority.NORMAL;
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
                cooperators: { select: { username: true, name: true } },
                followers: { select: { username: true, name: true } }
            },
            // Sort in memory to handle numeric string sorting
        });

        if (projects.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy dự án nào để export' });
        }

        // Custom sort projects by the numeric part of their code
        projects.sort((a, b) => {
            const getNumericPart = (code: string) => {
                const match = code.match(/(\d+)$/); // Extracts trailing numbers
                return match ? parseInt(match[1] ?? '0', 10) : 0; // Default to 0 if no number found
            };
            return getNumericPart(b.code) - getNumericPart(a.code);
        });

        // Transform data for Excel
        const excelData = projects.map(project => ({
            'Mã dự án': project.code,
            'Tên dự án': project.name,
            'Chủ đầu tư': project.investor || '',
            'Ngày bắt đầu': formatDateForExcel(project.startDate),
            'Ngày kết thúc': formatDateForExcel(project.endDate),
            'Thời hạn': project.duration || '',
            'Nhóm': project.group || '',
            'Giá trị': project.value || '',
            'Mô tả': project.description || '',
            'Mức độ ưu tiên': getPriorityText(project.priority),
            'Trạng thái': getStatusText(project.status),
            'Người quản lý': `${project.manager.name} (${project.manager.username})`,
            'Người thực hiện': project.implementers.map(u => `${u.name} (${u.username})`).join(', '),
            'Người phối hợp': project.cooperators.map(u => `${u.name} (${u.username})`).join(', '),
            'Ngày tạo': formatDateForExcel(project.createdAt)
        }));

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData, { header: EXPORT_HEADERS });

        // Set column widths
        ws['!cols'] = [
            { wch: 15 }, // Mã dự án
            { wch: 40 }, // Tên dự án
            { wch: 25 }, // Chủ đầu tư
            { wch: 15 }, // Ngày bắt đầu
            { wch: 15 }, // Ngày kết thúc
            { wch: 12 }, // Thời hạn
            { wch: 15 }, // Nhóm
            { wch: 15 }, // Giá trị
            { wch: 40 }, // Mô tả
            { wch: 15 }, // Mức độ ưu tiên
            { wch: 15 }, // Trạng thái
            { wch: 25 }, // Người quản lý
            { wch: 40 }, // Người thực hiện
            { wch: 40 }, // Người phối hợp
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

        // Prepare user list for validation
        const userOptions = users.map(u => `${u.name} (${u.username})`);

        // Main template sheet
        const templateData = [
            {
                'Mã dự án': 'DA-001',
                'Tên dự án': 'Dự án mẫu',
                'Chủ đầu tư': 'Công ty XYZ',
                'Ngày bắt đầu': '01/01/2025',
                'Ngày kết thúc': '31/03/2025',
                'Thời hạn': '3 tháng',
                'Nhóm': 'Nhóm A',
                'Giá trị': '100,000,000 VNĐ',
                'Mô tả': 'Mô tả chi tiết về dự án...',
                'Mức độ ưu tiên': 'Thường',
                'Trạng thái': 'Đang thực hiện',
                'Người quản lý': userOptions[0] || 'admin',
                'Người thực hiện': userOptions[1] || 'user1',
                'Người phối hợp': userOptions[2] || 'user3'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData, { header: IMPORT_HEADERS });

        // Set column widths
        ws['!cols'] = [
            { wch: 18 }, // Mã dự án
            { wch: 35 }, // Tên dự án
            { wch: 25 }, // Chủ đầu tư
            { wch: 15 }, // Ngày bắt đầu
            { wch: 15 }, // Ngày kết thúc
            { wch: 12 }, // Thời hạn
            { wch: 15 }, // Nhóm
            { wch: 20 }, // Giá trị
            { wch: 40 }, // Mô tả
            { wch: 15 }, // Mức độ ưu tiên
            { wch: 15 }, // Trạng thái
            { wch: 35 }, // Người quản lý (Wider for Name + Username)
            { wch: 45 }, // Người thực hiện
            { wch: 45 } // Người phối hợp
        ];

        // Add Data Validation for "Người quản lý" (Column L - index 11)
        // With "Mức độ ưu tiên" added, the column index for "Người quản lý" shifts if not careful.
        // Array order: 0:Code, 1:Name, 2:Inv., 3:Start, 4:End, 5:Dur, 6:Grp, 7:Val, 8:Desc, 9:Priority, 10:Status, 11:Manager
        // Column L is index 11 (A=0, B=1, ... L=11). Correct.
        const userListRange = `'Danh sách Users'!$A$2:$A$${users.length + 1}`;

        ws['!dataValidation'] = [
            {
                sqref: 'L2:L1000', // Apply to rows 2-1000 of column L (Người quản lý)
                type: 'list',
                operator: 'equal',
                formula1: userListRange,
                showErrorMessage: true,
                error: 'Vui lòng chọn nhân viên từ danh sách',
                errorTitle: 'Lỗi chọn nhân viên'
            }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Mẫu Import');

        // Add users reference sheet
        const usersData = users.map(u => ({
            'Chọn Nhân Sự': `${u.name} (${u.username})`, // First column for dropdown
            'Username': u.username,
            'Họ tên': u.name,
            'Vai trò': u.role === 'ADMIN' ? 'Admin' : 'Nhân viên'
        }));
        const wsUsers = XLSX.utils.json_to_sheet(usersData);
        wsUsers['!cols'] = [
            { wch: 35 }, // Combo column
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
            { 'Hướng dẫn': '2. Mã dự án phải là duy nhất.' },
            { 'Hướng dẫn': '3. Định dạng ngày: DD/MM/YYYY.' },
            { 'Hướng dẫn': '4. Người quản lý: Chọn từ danh sách dropdown (Định dạng: Tên (Username)).' },
            { 'Hướng dẫn': '5. Người thực hiện/phối hợp: Nhập danh sách định dạng "Tên (Username)", phân cách bởi dấu phẩy.' },
            { 'Hướng dẫn': '   Ví dụ: "Nguyen Van A (user1), Le Van B (user2)"' },
            { 'Hướng dẫn': '6. Trạng thái: Đang thực hiện, Chờ duyệt, Hoàn thành.' },
            { 'Hướng dẫn': '7. Mức độ ưu tiên: Thường, Cao (hoặc Gấp, Ưu tiên).' },
            { 'Hướng dẫn': '' },
            { 'Hướng dẫn': '=== LƯU Ý ===' },
            { 'Hướng dẫn': '- KHÔNG đổi tên sheet "Danh sách Users" vì dropdown box đang tham chiếu đến nó.' },
            { 'Hướng dẫn': '- Nếu dropdown không hoạt động, vui lòng copy từ cột A sheet "Danh sách Users".' }
        ];
        const wsInstructions = XLSX.utils.json_to_sheet(instructions);
        wsInstructions['!cols'] = [{ wch: 80 }];
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
        if (!sheetName) {
            return res.status(400).json({ message: 'File Excel không hợp lệ (không tìm thấy sheet nào)' });
        }
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            return res.status(400).json({ message: 'Lỗi đọc sheet dữ liệu' });
        }
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

            // 1. Try to extract username from format "Name (username)"
            const match = trimmed.match(/\(([^)]+)\)$/);
            if (match) {
                const extractedUsername = (match[1] as string).trim(); // username inside ()
                const byExtracted = userByUsername.get(extractedUsername);
                if (byExtracted) return { id: byExtracted, found: true };
            }

            // 2. Try exact username match
            const byUsername = userByUsername.get(trimmed);
            if (byUsername) return { id: byUsername, found: true };

            // 3. Try exact name match
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
                const code = row['Mã dự án'] || row['Mã dự án (*)'] || '';
                const name = row['Tên dự án'] || row['Tên dự án (*)'] || '';
                const investor = row['Chủ đầu tư'] || '';
                const startDateStr = row['Ngày bắt đầu'] || row['Ngày bắt đầu (DD/MM/YYYY)'] || '';
                const endDateStr = row['Ngày kết thúc'] || row['Ngày kết thúc (DD/MM/YYYY)'] || '';
                const duration = row['Thời hạn'] || '';
                const group = row['Nhóm'] || '';
                const value = row['Giá trị'] || '';
                const description = row['Mô tả'] || '';
                const priorityStr = row['Mức độ ưu tiên'] || 'Thường';
                const statusStr = row['Trạng thái'] || 'Đang thực hiện';

                const managerUsername = row['Người quản lý'] || row['Người quản lý (*)'] || row['Username người quản lý (*)'] || '';
                const implementersStr = row['Người thực hiện'] || row['Người thực hiện (phân cách bởi dấu phẩy)'] || row['Username người thực hiện (phân cách bởi dấu phẩy)'] || '';
                const cooperatorsStr = row['Người phối hợp'] || row['Người phối hợp (phân cách bởi dấu phẩy)'] || row['Username người phối hợp (phân cách bởi dấu phẩy)'] || '';

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

                // Function to parse users lists
                const parseUsersList = (str: string, roleName: string): number[] => {
                    const ids: number[] = [];
                    if (str.trim()) {
                        const names = str.split(',').map((s: string) => s.trim());
                        for (const nameOrUsername of names) {
                            if (nameOrUsername) {
                                const result = findUserId(nameOrUsername);
                                if (result.found && result.id) {
                                    ids.push(result.id);
                                } else {
                                    results.errors.push(`Dòng ${rowNum}: Không tìm thấy ${roleName} "${nameOrUsername}"`);
                                }
                            }
                        }
                    }
                    return ids;
                };

                const implementerIds = parseUsersList(implementersStr, 'người thực hiện');
                const cooperatorIds = parseUsersList(cooperatorsStr, 'người phối hợp');

                // Parse dates
                const startDate = parseDateFromExcel(startDateStr);
                const endDate = parseDateFromExcel(endDateStr);

                // Parse status
                const status = parseStatus(statusStr);
                const priority = parsePriority(priorityStr);

                // Progress is naturally 0 for new non-migrated projects usually, or manual.
                // Since field is removed, we default to 0.
                const progress = 0;

                const now = new Date();

                // Create project
                await prisma.project.create({
                    data: {
                        code: code.trim(),
                        name: name.trim(),
                        investor: investor.trim() || null,
                        startDate,
                        endDate,
                        duration: duration.trim() || null,
                        group: group.trim() || null,
                        value: value.trim() || null,
                        progressMethod: '', // Removed from import
                        description: description.trim() || null,
                        progress: progress,
                        status: status,
                        priority: priority,
                        managerId,
                        createdById: userId,
                        implementers: {
                            connect: implementerIds.map(id => ({ id }))
                        },
                        cooperators: {
                            connect: cooperatorIds.map(id => ({ id }))
                        },
                        // Initialize workflow
                        workflow: {
                            create: {
                                currentStatus: WorkflowStatus.RECEIVED,
                                receivedStartAt: now,
                            }
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
