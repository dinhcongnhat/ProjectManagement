import { useState, useEffect, useCallback } from 'react';

// ==================== CONFIGURATION ====================
// TODO: User must fill in these values for the pickers to work
const GOOGLE_APP_ID = '692743351231';
const GOOGLE_CLIENT_ID = '692743351231-ghohmlju0que7r6lep4fmfmhgh8hec8v.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyAa2PVlLuffcCJVIpWbLj0MfD1JugFVE9A';


// =======================================================

interface UseCloudStoragePickerProps {
    onSelect: (file: File) => void;
    onError?: (error: string) => void;
}

export const useCloudStoragePicker = ({ onSelect, onError }: UseCloudStoragePickerProps) => {
    const [isGoogleApiLoaded, setIsGoogleApiLoaded] = useState(false);


    // Initialize Google API
    useEffect(() => {
        const loadGoogleScript = () => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                const gapi = (window as any).gapi;
                if (gapi) {
                    gapi.load('picker', () => {
                        setIsGoogleApiLoaded(true);
                    });
                }
            };
            document.body.appendChild(script);

            const gsiScript = document.createElement('script');
            gsiScript.src = 'https://accounts.google.com/gsi/client';
            gsiScript.async = true;
            gsiScript.defer = true;
            document.body.appendChild(gsiScript);
        };

        if (!(window as any).gapi) {
            loadGoogleScript();
        } else {
            (window as any).gapi.load('picker', () => {
                setIsGoogleApiLoaded(true);
            });
        }
    }, []);

    const downloadGoogleFile = async (fileId: string, accessToken: string, mimeType: string, name: string) => {
        try {
            let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            let filename = name;

            // Handle Google Docs types
            if (mimeType === 'application/vnd.google-apps.document') {
                url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`;
                filename = `${name}.docx`;
            } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
                url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
                filename = `${name}.xlsx`;
            } else if (mimeType === 'application/vnd.google-apps.presentation') {
                url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.presentationml.presentation`;
                filename = `${name}.pptx`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }

            const blob = await response.blob();
            // Detect actual mime type from blob or response (optional)
            // Create File object
            const file = new File([blob], filename, { type: blob.type || mimeType });
            onSelect(file);

        } catch (error) {
            console.error('Error downloading Google Drive file:', error);
            onError?.('Lỗi khi tải file từ Google Drive');
        }
    };


    // Open Google Drive Picker
    const openGoogleDrivePicker = useCallback(() => {


        const gapi = (window as any).gapi;
        const google = (window as any).google;

        if (!gapi || !google || !isGoogleApiLoaded) {
            onError?.('Google API chưa sẵn sàng. Vui lòng thử lại sau giây lát.');
            return;
        }

        const createPicker = (access_token: string) => {
            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .setOAuthToken(access_token)
                .setDeveloperKey(GOOGLE_API_KEY)
                .setAppId(GOOGLE_APP_ID)
                .setCallback((data: any) => {
                    if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
                        const doc = data[google.picker.Response.DOCUMENTS][0];
                        const fileId = doc[google.picker.Document.ID];
                        const mimeType = doc[google.picker.Document.MIME_TYPE];
                        const name = doc[google.picker.Document.NAME];

                        // Download the file immediately
                        downloadGoogleFile(fileId, access_token, mimeType, name);
                    }
                })
                .build();
            picker.setVisible(true);
        };

        // Authenticate
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            // Request drive.readonly scope to allow downloading files
            scope: 'https://www.googleapis.com/auth/drive.readonly',
            callback: (response: any) => {
                if (response.error !== undefined) {
                    onError?.('Lỗi đăng nhập Google: ' + response.error);
                    throw (response);
                }
                createPicker(response.access_token);
            },
        });

        tokenClient.requestAccessToken();
    }, [isGoogleApiLoaded, onSelect, onError]);



    return {
        openGoogleDrivePicker,
        isGoogleReady: isGoogleApiLoaded
    };
};
