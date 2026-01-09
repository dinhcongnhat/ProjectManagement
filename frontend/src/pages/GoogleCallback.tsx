
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { googleDriveService } from '../services/googleDriveService';
import { toast } from 'react-hot-toast';

const GoogleCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('Processing...');

    useEffect(() => {
        const code = searchParams.get('code');
        if (code) {
            handleAuth(code);
        } else {
            setStatus('No code found');
            setTimeout(() => window.close(), 2000);
        }
    }, [searchParams]);

    const handleAuth = async (code: string) => {
        try {
            await googleDriveService.sendAuthCode(code);
            toast.success('Connected to Google Drive successfully!');
            // Signal success to parent window if opened in popup
            if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                window.close();
            } else {
                navigate('/');
            }
        } catch (error) {
            console.error(error);
            setStatus('Authentication failed');
            toast.error('Failed to connect to Google Drive');
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
                <h2 className="text-xl font-bold mb-4">Google Drive Integration</h2>
                <p>{status}</p>
            </div>
        </div>
    );
};

export default GoogleCallback;
