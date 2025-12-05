import type { Response } from 'express';
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

        // Get presigned URL for avatar if stored in MinIO
        let avatarUrl = null;
        if (user.avatar) {
            // Check if it's a base64 string or MinIO path
            if (user.avatar.startsWith('data:')) {
                avatarUrl = user.avatar; // Already base64
            } else {
                try {
                    avatarUrl = await getPresignedUrl(user.avatar);
                } catch (e) {
                    console.error('Error getting avatar URL:', e);
                }
            }
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

        // Lấy URL avatar nếu có
        let avatarUrl = null;
        if (user.avatar) {
            if (user.avatar.startsWith('data:')) {
                avatarUrl = user.avatar;
            } else {
                try {
                    avatarUrl = await getPresignedUrl(user.avatar);
                } catch (e) {
                    console.error('Error getting avatar URL:', e);
                }
            }
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

        // Upload to MinIO
        const normalizedFilename = normalizeVietnameseFilename(req.file.originalname);
        const fileName = `avatars/${userId}-${Date.now()}-${normalizedFilename}`;
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

        // Get presigned URL for the avatar
        let avatarUrl = null;
        if (user.avatar) {
            try {
                avatarUrl = await getPresignedUrl(user.avatar);
            } catch (e) {
                console.error('[uploadAvatar] Error getting avatar URL:', e);
            }
        }

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

        // Lấy URL avatar nếu có
        let avatarUrl = null;
        if (user.avatar) {
            if (user.avatar.startsWith('data:')) {
                avatarUrl = user.avatar;
            } else {
                try {
                    avatarUrl = await getPresignedUrl(user.avatar);
                } catch (e) {
                    console.error('Error getting avatar URL:', e);
                }
            }
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

        // Thêm URL avatar cho từng user
        const usersWithAvatarUrls = await Promise.all(users.map(async (user) => {
            let avatarUrl = null;
            if (user.avatar) {
                if (user.avatar.startsWith('data:')) {
                    avatarUrl = user.avatar;
                } else {
                    try {
                        avatarUrl = await getPresignedUrl(user.avatar);
                    } catch (e) {
                        console.error('Error getting avatar URL:', e);
                    }
                }
            }
            return { ...user, avatarUrl };
        }));

        res.json(usersWithAvatarUrls);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
