import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { createActivity } from './activityController.js';

// Xác nhận "Đã nhận thông tin" - Chuyển sang trạng thái "Đang thực hiện"
export const confirmReceived = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;  // projectId
        const now = new Date();

        const workflow = await prisma.projectWorkflow.findUnique({
            where: { projectId: Number(id) },
        });

        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found for this project' });
        }

        if (workflow.currentStatus !== 'RECEIVED') {
            return res.status(400).json({ message: 'Dự án không ở trạng thái "Đã nhận thông tin"' });
        }

        const updatedWorkflow = await prisma.projectWorkflow.update({
            where: { projectId: Number(id) },
            data: {
                receivedConfirmedAt: now,
                inProgressStartAt: now,  // Ngày bắt đầu "Đang thực hiện" = khi xác nhận "Đã nhận thông tin"
                currentStatus: 'IN_PROGRESS',
            },
            include: {
                project: { select: { id: true, name: true } }
            }
        });

        // Log activity
        if (req.user?.id) {
            await createActivity(
                Number(id),
                req.user.id,
                'Xác nhận đã nhận thông tin - Chuyển sang trạng thái "Đang thực hiện"',
                'workflowStatus',
                'RECEIVED',
                'IN_PROGRESS'
            );
        }

        res.json(updatedWorkflow);
    } catch (error) {
        console.error('Error confirming received:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Xác nhận "Đang thực hiện" - Chuyển sang trạng thái "Đã hoàn thành" 
export const confirmInProgress = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;  // projectId
        const now = new Date();

        const workflow = await prisma.projectWorkflow.findUnique({
            where: { projectId: Number(id) },
        });

        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found for this project' });
        }

        if (workflow.currentStatus !== 'IN_PROGRESS') {
            return res.status(400).json({ message: 'Dự án không ở trạng thái "Đang thực hiện"' });
        }

        const updatedWorkflow = await prisma.projectWorkflow.update({
            where: { projectId: Number(id) },
            data: {
                inProgressConfirmedAt: now,
                completedStartAt: now,  // Ngày bắt đầu "Đã hoàn thành" = khi xác nhận "Đang thực hiện"
                currentStatus: 'COMPLETED',
            },
            include: {
                project: { select: { id: true, name: true } }
            }
        });

        // Log activity
        if (req.user?.id) {
            await createActivity(
                Number(id),
                req.user.id,
                'Xác nhận hoàn thành công việc - Chờ PM duyệt',
                'workflowStatus',
                'IN_PROGRESS',
                'COMPLETED'
            );
        }

        res.json(updatedWorkflow);
    } catch (error) {
        console.error('Error confirming in progress:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PM duyệt "Đã hoàn thành" - Cho phép chuyển sang "Đã gửi khách hàng"
export const approveCompleted = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;  // projectId
        const userId = req.user?.id;
        const now = new Date();

        // Kiểm tra project và quyền PM
        const project = await prisma.project.findUnique({
            where: { id: Number(id) },
            select: {
                managerId: true,
                manager: { select: { name: true } },
            }
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Chỉ PM hoặc Admin mới được duyệt
        const isAdmin = req.user?.role === 'ADMIN';
        const isManager = project.managerId === userId;

        if (!isAdmin && !isManager) {
            return res.status(403).json({
                message: 'Chỉ quản lý dự án hoặc Admin mới có quyền duyệt hoàn thành'
            });
        }

        const workflow = await prisma.projectWorkflow.findUnique({
            where: { projectId: Number(id) },
        });

        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found for this project' });
        }

        if (workflow.currentStatus !== 'COMPLETED') {
            return res.status(400).json({ message: 'Dự án không ở trạng thái "Đã hoàn thành"' });
        }

        // Kiểm tra đã được duyệt chưa
        if (workflow.completedApprovedAt) {
            return res.status(400).json({ message: 'Dự án đã được duyệt hoàn thành rồi' });
        }

        // Kiểm tra userId hợp lệ
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const updatedWorkflow = await prisma.projectWorkflow.update({
            where: { projectId: Number(id) },
            data: {
                completedApprovedAt: now,
                completedApprovedById: userId,
            },
            include: {
                project: { select: { id: true, name: true } },
                completedApprovedBy: { select: { id: true, name: true } }
            }
        });

        // Log activity
        await createActivity(
            Number(id),
            userId,
            'PM duyệt hoàn thành - Có thể gửi khách hàng',
            'workflowApproval',
            'pending',
            'approved'
        );

        res.json(updatedWorkflow);
    } catch (error) {
        console.error('Error approving completed:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Xác nhận "Đã gửi khách hàng" - Trạng thái cuối cùng
export const confirmSentToCustomer = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;  // projectId
        const now = new Date();

        const workflow = await prisma.projectWorkflow.findUnique({
            where: { projectId: Number(id) },
        });

        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found for this project' });
        }

        if (workflow.currentStatus !== 'COMPLETED') {
            return res.status(400).json({ message: 'Dự án không ở trạng thái "Đã hoàn thành"' });
        }

        // Kiểm tra PM đã duyệt hoàn thành chưa
        if (!workflow.completedApprovedAt) {
            return res.status(400).json({
                message: 'Phải có quản lý dự án duyệt "Đã hoàn thành" trước khi gửi khách hàng'
            });
        }

        const updatedWorkflow = await prisma.projectWorkflow.update({
            where: { projectId: Number(id) },
            data: {
                completedConfirmedAt: now,
                sentToCustomerAt: now,
                currentStatus: 'SENT_TO_CUSTOMER',
            },
            include: {
                project: { select: { id: true, name: true } },
                completedApprovedBy: { select: { id: true, name: true } }
            }
        });

        // Cập nhật project status thành COMPLETED
        await prisma.project.update({
            where: { id: Number(id) },
            data: {
                status: 'COMPLETED',
                progress: 100,
            }
        });

        // Log activity
        if (req.user?.id) {
            await createActivity(
                Number(id),
                req.user.id,
                'Xác nhận đã gửi khách hàng - Hoàn tất dự án',
                'workflowStatus',
                'COMPLETED',
                'SENT_TO_CUSTOMER'
            );
        }

        res.json(updatedWorkflow);
    } catch (error) {
        console.error('Error confirming sent to customer:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Lấy workflow của project
export const getProjectWorkflow = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;  // projectId

        const workflow = await prisma.projectWorkflow.findUnique({
            where: { projectId: Number(id) },
            include: {
                completedApprovedBy: { select: { id: true, name: true } }
            }
        });

        if (!workflow) {
            // Tạo workflow mới nếu chưa có (cho các project cũ)
            const newWorkflow = await prisma.projectWorkflow.create({
                data: {
                    projectId: Number(id),
                    currentStatus: 'RECEIVED',
                    receivedStartAt: new Date(),
                },
                include: {
                    completedApprovedBy: { select: { id: true, name: true } }
                }
            });
            return res.json(newWorkflow);
        }

        res.json(workflow);
    } catch (error) {
        console.error('Error fetching workflow:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
