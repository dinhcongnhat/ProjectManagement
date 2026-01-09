
import type { Request, Response } from 'express';
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Helper to get authenticated drive client for a user
const getDriveClient = async (userId: number) => {
    const integration = await prisma.googleIntegration.findUnique({
        where: { userId },
    });

    if (!integration) {
        throw new Error('Google Drive not connected');
    }

    // Check if token needs refresh
    oauth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
        expiry_date: Number(integration.expiryDate), // Convert BigInt to number
    });

    // Auto handle refresh if needed via googleapis internal logic, 
    // but we should listen to 'tokens' event or check manually to update DB?
    // googleapis automatically refreshes if refresh_token is present.
    // We need to capture new tokens if they change.

    return google.drive({ version: 'v3', auth: oauth2Client });
};

// Update tokens in DB if refreshed
oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
        // Ideally we need to know WHICH user this is for. 
        // This event based approach is tricky with single global client instance in Node single thread 
        // if we process multiple users. 
        // BETTER APPROACH: creating a new OAuth2Client instance per request is safer for concurrency 
        // but slightly more overhead. Let's do instance-per-request inside helper.
    }
});

export const getUserAuth = async (userId: number) => {
    const integration = await prisma.googleIntegration.findUnique({
        where: { userId },
    });
    if (!integration) return null;

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error('[GoogleDrive] Missing Client ID or Secret in environment variables');
        throw new Error('Server configuration error: Google Drive credentials missing');
    }

    const userClient = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    userClient.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
        expiry_date: Number(integration.expiryDate)
    });

    // Handle token refresh callback logic explicitly if needed, or rely on simple use
    // For concurrent safety, we should wrap operations and catch "token expired" then refresh manually if google lib doesn't
    // The google lib DOES handle refresh if refresh_token is set.
    // To update DB, we can check client.credentials after an op, or set a listener.
    // Since listeners are on the client instance, creating a new instance per user request is safe.

    userClient.on('tokens', async (tokens) => {
        // Save new tokens to DB
        await prisma.googleIntegration.update({
            where: { userId },
            data: {
                accessToken: tokens.access_token || integration.accessToken,
                refreshToken: tokens.refresh_token || integration.refreshToken,
                expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : integration.expiryDate
            }
        });
    });

    return userClient;
}


export const checkConnection = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        const integration = await prisma.googleIntegration.findUnique({
            where: { userId },
            select: { email: true, createdAt: true }
        });

        if (integration) {
            res.json({ connected: true, email: integration.email });
        } else {
            res.json({ connected: false });
        }
    } catch (error) {
        console.error('Check Connection Error:', error);
        res.status(500).json({ error: 'Failed to check connection' });
    }
};


export const getAuthUrl = async (req: Request, res: Response) => {
    try {
        const scopes = [
            'https://www.googleapis.com/auth/drive', // Full access required for listing ALL files AND editing/copying
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ];

        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
            console.error('Missing Google Drive environment variables');
            return res.status(500).json({ error: 'Server configuration missing: Google Drive credentials not set' });
        }

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Essential for refresh_token
            scope: scopes,
            prompt: 'consent', // Force consent to ensure refresh_token is returned
            include_granted_scopes: true
        });

        res.json({ url });
    } catch (error) {
        console.error('Google Auth URL Error:', error);
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
};

export const handleCallback = async (req: Request, res: Response) => {
    try {
        const { code } = req.body;
        // @ts-ignore
        const userId = req.user.id;

        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user info to verify
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        // Upsert integration
        await prisma.googleIntegration.upsert({
            where: { userId },
            update: {
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token!, // This might be undefined on re-auth without prompt='consent'
                expiryDate: BigInt(tokens.expiry_date || Date.now()),
                email: userInfo.data.email || null,
                avatar: userInfo.data.picture || null,
                scope: tokens.scope || ''
            },
            create: {
                userId,
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token!,
                expiryDate: BigInt(tokens.expiry_date || Date.now()),
                email: userInfo.data.email || null,
                avatar: userInfo.data.picture || null,
                scope: tokens.scope || ''
            }
        });

        res.json({ success: true, user: userInfo.data });
    } catch (error) {
        console.error('Auth Callback Error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

export const listDriveFiles = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        const { folderId, q } = req.query;

        const auth = await getUserAuth(userId);
        if (!auth) return res.status(400).json({ error: 'Google Drive not connected' });

        const drive = google.drive({ version: 'v3', auth });

        // Build query
        let query = "trashed = false";
        if (folderId) {
            query += ` and '${folderId}' in parents`;
        } else if (!q) {
            // Default to root if no search
            query += " and 'root' in parents";
        }

        if (q) {
            query += ` and name contains '${q}'`;
        }

        const response = await drive.files.list({
            q: query,
            fields: 'nextPageToken, files(id, name, mimeType, iconLink, webViewLink, thumbnailLink, hasThumbnail)',
            pageSize: 1000,
        });

        console.log(`[Drive] Query: "${query}" | Found: ${response.data.files?.length || 0} files`);

        res.json({ files: response.data.files, nextPageToken: response.data.nextPageToken });
    } catch (error: any) {
        console.error('Drive List Error [Full Stack]:', error);
        if (error.response) {
            console.error('Drive API Response Error:', error.response.data);
        }
        res.status(500).json({
            error: 'Failed to list files',
            details: error.message
        });
    }
};

// Link a file to a project
export const linkFileToProject = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        const { projectId, fileId, name, mimeType, webViewLink, iconLink, resourceType } = req.body;

        const link = await prisma.projectDriveLink.create({
            data: {
                projectId: Number(projectId),
                fileId,
                name,
                mimeType,
                webViewLink,
                iconLink,
                resourceType,
                addedByUserId: userId
            }
        });

        res.json(link);
    } catch (error) {
        console.error('Link File Error:', error);
        res.status(500).json({ error: 'Failed to link file' });
    }
};

// Get linked files for a project
export const getProjectLinks = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        // Check permission logic here (if needed)

        const links = await prisma.projectDriveLink.findMany({
            where: { projectId: Number(projectId) },
            include: {
                addedBy: {
                    select: { id: true, name: true, avatar: true }
                }
            }
        });

        res.json(links);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch links' });
    }
};

export const downloadFile = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required' });
        }

        const auth = await getUserAuth(userId);
        if (!auth) return res.status(400).json({ error: 'Google Drive not connected' });

        const drive = google.drive({ version: 'v3', auth });

        // Get file metadata for name and mimeType
        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'name, mimeType, size'
        });

        const originalName = fileMetadata.data.name || 'download';
        const originalMimeType = fileMetadata.data.mimeType || 'application/octet-stream';

        let mimeType = originalMimeType;
        let name = originalName;
        let isGoogleDoc = false;

        // Map Google Apps types to export types
        if (originalMimeType === 'application/vnd.google-apps.document') {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            name = `${originalName}.docx`;
            isGoogleDoc = true;
        } else if (originalMimeType === 'application/vnd.google-apps.spreadsheet') {
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            name = `${originalName}.xlsx`;
            isGoogleDoc = true;
        } else if (originalMimeType === 'application/vnd.google-apps.presentation') {
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            name = `${originalName}.pptx`;
            isGoogleDoc = true;
        }

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
        res.setHeader('Content-Type', mimeType);

        if (isGoogleDoc) {
            // Export file
            const response = await drive.files.export({
                fileId: fileId,
                mimeType: mimeType
            }, { responseType: 'stream' });
            (response.data as any).pipe(res);
        } else {
            // Stream normal file
            const response = await drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'stream' });
            (response.data as any).pipe(res);
        }
    } catch (error) {
        console.error('Download File Error:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
};

export const disconnectDrive = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        await prisma.googleIntegration.deleteMany({
            where: { userId }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Disconnect Drive Error:', error);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
};

export const createFolder = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        const { name, parentId } = req.body;

        if (!name) return res.status(400).json({ error: 'Folder name is required' });

        const auth = await getUserAuth(userId);
        if (!auth) return res.status(400).json({ error: 'Google Drive not connected' });

        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata: any = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder',
        };

        if (parentId) {
            fileMetadata.parents = [parentId];
        }

        const file = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id, name, mimeType'
        });

        res.json(file.data);

    } catch (error: any) {
        console.error('Create Drive Folder Error:', error);
        res.status(500).json({ error: 'Failed to create folder', message: error.message });
    }
};
