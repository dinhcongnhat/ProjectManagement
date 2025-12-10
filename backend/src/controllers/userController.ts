import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import { uploadFile, getPresignedUrl, normalizeVietnameseFilename } from '../services/minioService.js';

export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                position: true,
            },
        });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        const { username, password, name, role, position } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                role: role || 'USER',
                position,
            },
        });

        res.status(201).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { username, name, role, position, password } = req.body;

        const updateData: any = {
            username,
            name,
            role,
            position,
        };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: updateData,
        });

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = Number(id);

        // Check if user is managing any projects
        const managedProjects = await prisma.project.findMany({
            where: { managerId: userId },
            select: { id: true, name: true }
        });

        if (managedProjects.length > 0) {
            return res.status(400).json({ 
                message: `Không thể xóa người dùng này vì đang quản lý ${managedProjects.length} dự án. Vui lòng chuyển quyền quản lý trước khi xóa.`,
                projects: managedProjects
            });
        }

        // Check if user has created tasks
        const createdTasks = await prisma.task.findMany({
            where: { creatorId: userId },
            select: { id: true }
        });

        // Check if user has assigned tasks
        const assignedTasks = await prisma.task.findMany({
            where: { assigneeId: userId },
            select: { id: true }
        });

        // Use transaction to safely delete user and related data
        await prisma.$transaction(async (tx) => {
            // Disconnect from implementers
            const implementedProjects = await tx.project.findMany({
                where: { implementers: { some: { id: userId } } }
            });
            for (const project of implementedProjects) {
                await tx.project.update({
                    where: { id: project.id },
                    data: { implementers: { disconnect: { id: userId } } }
                });
            }

            // Disconnect from followers
            const followedProjects = await tx.project.findMany({
                where: { followers: { some: { id: userId } } }
            });
            for (const project of followedProjects) {
                await tx.project.update({
                    where: { id: project.id },
                    data: { followers: { disconnect: { id: userId } } }
                });
            }

            // Update created tasks to transfer to current admin
            if (createdTasks.length > 0) {
                await tx.task.updateMany({
                    where: { creatorId: userId },
                    data: { creatorId: req.user?.id || 1 }
                });
            }

            // Unassign tasks from user
            if (assignedTasks.length > 0) {
                await tx.task.updateMany({
                    where: { assigneeId: userId },
                    data: { assigneeId: null }
                });
            }

            // Transfer conversations ownership to current admin
            await tx.conversation.updateMany({
                where: { createdById: userId },
                data: { createdById: req.user?.id || 1 }
            });

            // Remove user from conversation members
            await tx.conversationMember.deleteMany({
                where: { userId: userId }
            });

            // Delete user's chat messages (must delete because of FK constraint)
            await tx.chatMessage.deleteMany({
                where: { senderId: userId }
            });

            // Delete user's project messages
            await tx.message.deleteMany({
                where: { senderId: userId }
            });

            // Delete user's activities
            await tx.projectActivity.deleteMany({
                where: { userId: userId }
            });

            // Finally delete the user
            await tx.user.delete({ where: { id: userId } });
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Không thể xóa người dùng. Vui lòng thử lại.' });
    }
};

// Lấy profile hiện tại
export const getProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                position: true,
                avatar: true,
                bio: true,
                phone: true,
                email: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get relative URL for avatar
        let avatarUrl = null;
        if (user.avatar) {
            avatarUrl = `/api/users/${user.id}/avatar`;
        }
        
        res.json({ ...user, avatarUrl });
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Cập nhật profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { name, bio, phone, email } = req.body;

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                bio,
                phone,
                email
            },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                position: true,
                avatar: true,
                bio: true,
                phone: true,
                email: true
            }
        });

        // Lấy URL avatar - use relative URL
        let avatarUrl = null;
        if (user.avatar) {
            avatarUrl = `/api/users/${user.id}/avatar`;
        }

        res.json({ ...user, avatarUrl });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Upload avatar
export const uploadAvatar = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        console.log('[uploadAvatar] Starting upload for user:', userId);

        if (!req.file) {
            console.log('[uploadAvatar] No file in request');
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('[uploadAvatar] File info:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        // Validate file type
        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({ message: 'Only image files are allowed' });
        }

        // Validate file size (max 5MB)
        if (req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: 'File size must be less than 5MB' });
        }

        // Upload to MinIO with original filename
        const normalizedFilename = normalizeVietnameseFilename(req.file.originalname);
        const fileName = `avatars/${normalizedFilename}`;
        console.log('[uploadAvatar] Uploading to MinIO:', fileName);
        
        const avatarPath = await uploadFile(fileName, req.file.buffer, {
            'Content-Type': req.file.mimetype,
        });
        console.log('[uploadAvatar] Upload successful:', avatarPath);

        // Update user avatar path
        const user = await prisma.user.update({
            where: { id: userId },
            data: { avatar: avatarPath },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                position: true,
                avatar: true,
                bio: true,
                phone: true,
                email: true
            }
        });
        console.log('[uploadAvatar] User updated:', user.id);

        // Get relative URL for the avatar
        const avatarUrl = `/api/users/${user.id}/avatar`;

        res.json({ ...user, avatarUrl });
    } catch (error) {
        console.error('[uploadAvatar] Error:', error);
        res.status(500).json({ message: 'Không thể tải lên ảnh đại diện. Vui lòng thử lại.' });
    }
};

// Đổi mật khẩu
export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Lấy thông tin user theo ID (public)
export const getUserById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Validate id
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const user = await prisma.user.findUnique({
            where: { id: Number(id) },
            select: {
                id: true,
                name: true,
                username: true,
                position: true,
                avatar: true,
                bio: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Lấy URL avatar - use relative URL
        let avatarUrl = null;
        if (user.avatar) {
            avatarUrl = `/api/users/${user.id}/avatar`;
        }

        res.json({ ...user, avatarUrl });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Lấy tất cả users với avatar (cho chat)
export const getAllUsersWithAvatar = async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                position: true,
                avatar: true
            }
        });

        // Thêm URL avatar cho từng user - use relative URL
        const usersWithAvatarUrls = users.map((user) => {
            let avatarUrl = null;
            if (user.avatar) {
                avatarUrl = `/api/users/${user.id}/avatar`;
            }
            return { ...user, avatarUrl };
        });

        res.json(usersWithAvatarUrls);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Serve user avatar directly (for img src to work without mixed content issues)
export const serveUserAvatar = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const user = await prisma.user.findUnique({
            where: { id: Number(id) },
            select: { avatar: true }
        });

        if (!user || !user.avatar) {
            return res.status(404).json({ message: 'Avatar not found' });
        }

        // If avatar is base64 data URL, convert and send
        if (user.avatar.startsWith('data:')) {
            console.log('[serveUserAvatar] Serving base64 avatar');
            const matches = user.avatar.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches[1] && matches[2]) {
                const contentType = matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Length', buffer.length);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.send(buffer);
            }
        }

        console.log('[serveUserAvatar] Avatar path:', user.avatar);

        // Redirect to presigned URL from MinIO
        const { getPresignedUrl } = await import('../services/minioService.js');
        
        try {
            const presignedUrl = await getPresignedUrl(user.avatar, 3600); // 1 hour expiry
            console.log('[serveUserAvatar] Redirecting to presigned URL');
            
            // Redirect to presigned URL
            res.redirect(presignedUrl);
        } catch (minioError: any) {
            console.error('[serveUserAvatar] MinIO error:', minioError?.message || minioError);
            return res.status(404).json({ message: 'Avatar file not found in storage' });
        }
    } catch (error: any) {
        console.error('[serveUserAvatar] Error:', error?.message || error);
        res.status(500).json({ message: 'Failed to serve avatar' });
    }
};
