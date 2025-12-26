import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { createActivity } from './activityController.js';
import { notifyProjectUpdate } from '../services/pushNotificationService.js';

// Helper to get project members for notification
const getProjectMembers = async (projectId: number) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            managerId: true,
            implementers: { select: { id: true } },
            followers: { select: { id: true } },
            cooperators: { select: { id: true } },
            createdById: true
        }
    });

    if (!project) return [];

    const memberIds = new Set<number>();
    memberIds.add(project.managerId);
    if (project.createdById) memberIds.add(project.createdById);
    project.implementers.forEach(u => memberIds.add(u.id));
    project.followers.forEach(u => memberIds.add(u.id));
    project.cooperators.forEach(u => memberIds.add(u.id));

    return Array.from(memberIds);
};

// Xác nhận "Đã nhận thông tin" - Chuyển sang trạng thái "Đang thực hiện"
export const confirmReceived = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;  // projectId
        const now = new Date();
        const userId = req.user?.id;
        const userName = req.user?.name || 'User';

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

        // Sync Project Status
        await prisma.project.update({
            where: { id: Number(id) },
            data: { status: 'IN_PROGRESS', progress: 0 }
        });

        // Log activity
        if (userId) {
            await createActivity(
                Number(id),
                userId,
                'Xác nhận đã nhận thông tin - Chuyển sang trạng thái "Đang thực hiện"',
                'workflowStatus',
                'RECEIVED',
                'IN_PROGRESS'
            );

            // Notify all members
            const memberIds = await getProjectMembers(Number(id));
            await notifyProjectUpdate(
                memberIds,
                userId,
                userName,
                Number(id),
                updatedWorkflow.project.name,
                'đã xác nhận nhận thông tin dự án. Trạng thái: Đang thực hiện.'
            );
        }

        res.json(updatedWorkflow);
    } catch (error) {
        console.error('Error confirming received:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Xác nhận "Đang thực hiện" - Chuyển sang trạng thái "Đã hoàn thành" (Pending Approval)
export const confirmInProgress = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;  // projectId
        const now = new Date();
        const userId = req.user?.id;
        const userName = req.user?.name || 'User';

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
                project: { select: { id: true, name: true, managerId: true, createdById: true } }
            }
        });

        // Sync Project Status to PENDING_APPROVAL
        await prisma.project.update({
            where: { id: Number(id) },
            data: { status: 'PENDING_APPROVAL', progress: 100 }
        });

        // Log activity
        if (userId) {
            await createActivity(
                Number(id),
                userId,
                'Xác nhận hoàn thành công việc - Chờ quản lý duyệt',
                'workflowStatus',
                'IN_PROGRESS',
                'COMPLETED' // Workflow status is completed(step 3), but approval pending
            );

            // Notify Manager and Admin
            const recipientIds = new Set<number>();
            recipientIds.add(updatedWorkflow.project.managerId);
            if (updatedWorkflow.project.createdById) recipientIds.add(updatedWorkflow.project.createdById);

            await notifyProjectUpdate(
                Array.from(recipientIds),
                userId,
                userName,
                Number(id),
                updatedWorkflow.project.name,
                'đã báo cáo hoàn thành công việc. Vui lòng kiểm tra và duyệt.'
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
        const userName = req.user?.name || 'Quản lý';
        const now = new Date();

        // Kiểm tra project và quyền PM
        const project = await prisma.project.findUnique({
            where: { id: Number(id) },
            select: {
                managerId: true,
                createdById: true,
                manager: { select: { name: true } },
            }
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Chỉ PM, Creator hoặc Admin mới được duyệt
        const isAdmin = req.user?.role === 'ADMIN';
        const isManager = project.managerId === userId;
        const isCreator = project.createdById === userId;

        if (!isAdmin && !isManager && !isCreator) {
            return res.status(403).json({
                message: 'Chỉ quản lý dự án, người tạo dự án hoặc Admin mới có quyền duyệt hoàn thành'
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

        // Sync Project Status to COMPLETED
        await prisma.project.update({
            where: { id: Number(id) },
            data: { status: 'COMPLETED', progress: 100 }
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

        // Notify All Project Members
        const memberIds = await getProjectMembers(Number(id));
        await notifyProjectUpdate(
            memberIds,
            userId,
            userName,
            Number(id),
            updatedWorkflow.project.name,
            'đã duyệt hoàn thành dự án. Có thể gửi kết quả cho khách hàng.'
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
        const userId = req.user?.id;
        const userName = req.user?.name || 'User';

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
                project: { select: { id: true, name: true, managerId: true, createdById: true } },
                completedApprovedBy: { select: { id: true, name: true } }
            }
        });

        // Cập nhật project status thành COMPLETED (ensure it stays completed)
        await prisma.project.update({
            where: { id: Number(id) },
            data: {
                status: 'COMPLETED',
                progress: 100,
            }
        });

        // Log activity
        if (userId) {
            await createActivity(
                Number(id),
                userId,
                'Xác nhận đã gửi khách hàng - Hoàn tất dự án',
                'workflowStatus',
                'COMPLETED',
                'SENT_TO_CUSTOMER'
            );

            // Notify Admin and Manager
            const recipientIds = new Set<number>();
            recipientIds.add(updatedWorkflow.project.managerId);
            if (updatedWorkflow.project.createdById) recipientIds.add(updatedWorkflow.project.createdById);

            await notifyProjectUpdate(
                Array.from(recipientIds),
                userId,
                userName,
                Number(id),
                updatedWorkflow.project.name,
                'đã xác nhận gửi kết quả cho khách hàng.'
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
