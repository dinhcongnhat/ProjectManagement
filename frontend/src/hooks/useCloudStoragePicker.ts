import { useState, useEffect, useCallback } from 'react';

// ==================== CONFIGURATION ====================
// TODO: User must fill in these values for the pickers to work
const GOOGLE_APP_ID = '692743351231';
const GOOGLE_CLIENT_ID = '692743351231-ghohmlju0que7r6lep4fmfmhgh8hec8v.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyAa2PVlLuffcCJVIpWbLj0MfD1JugFVE9A';


// =======================================================

interface CloudFile {
    name: string;
    url: string;
    type: 'google-drive';
}

interface UseCloudStoragePickerProps {
    onSelect: (file: CloudFile) => void;
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
                        onSelect({
                            name: doc[google.picker.Document.NAME],
                            url: doc[google.picker.Document.URL],
                            type: 'google-drive'
                        });
                    }
                })
                .build();
            picker.setVisible(true);
        };

        // Authenticate
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file',
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
