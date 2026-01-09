import api from '../config/api';

export const googleDriveService = {
    getAuthUrl: async () => {
        const response = await api.get('/drive/auth/url');
        return response.data.url;
    },

    checkConnection: async () => {
        const response = await api.get('/drive/status');
        return response.data;
    },

    sendAuthCode: async (code: string) => {
        const response = await api.post('/drive/auth/callback', { code });
        return response.data;
    },

    listFiles: async (folderId?: string, q?: string) => {
        const params: Record<string, string> = {};
        if (folderId) params.folderId = folderId;
        if (q) params.q = q;

        const response = await api.get('/drive/files', { params });
        return response.data;
    },

    downloadFile: async (fileId: string): Promise<Blob> => {
        const response = await api.get(`/drive/files/${fileId}/download`, {
            responseType: 'blob'
        } as any);
        return response.data as Blob;
    },

    linkFile: async (projectId: number, fileData: any) => {
        const response = await api.post('/drive/link', {
            projectId,
            ...fileData
        });
        return response.data;
    },

    getProjectLinks: async (projectId: number) => {
        const response = await api.get(`/drive/projects/${projectId}/links`);
        return response.data;
    },

    disconnect: async () => {
        await api.delete('/drive/disconnect');
    }
};
