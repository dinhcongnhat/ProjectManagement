import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { API_URL } from '../config/api';
import { useAuth } from './AuthContext';

interface NotificationSettings {
    chatMessages: boolean;
    projectAssignments: boolean;
    projectDiscussions: boolean;
    projectUpdates: boolean;
    taskAssignments: boolean;
    mentions: boolean;
    kanbanNotifications: boolean;
}

interface PushNotificationContextType {
    isSupported: boolean;
    isSubscribed: boolean;
    permission: NotificationPermission;
    settings: NotificationSettings | null;
    loading: boolean;
    error: string | null;
    subscribe: () => Promise<boolean>;
    unsubscribe: () => Promise<boolean>;
    requestPermission: () => Promise<boolean>;
    updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
    sendTestNotification: () => Promise<void>;
}

const defaultSettings: NotificationSettings = {
    chatMessages: true,
    projectAssignments: true,
    projectDiscussions: true,
    projectUpdates: true,
    taskAssignments: true,
    mentions: true,
    kanbanNotifications: true
};

// LocalStorage keys for persisting notification state
const LS_PUSH_ENABLED = 'push-notification-enabled';
const LS_PUSH_USER_ID = 'push-notification-user-id';

const PushNotificationContext = createContext<PushNotificationContextType | null>(null);

export const usePushNotifications = () => {
    const context = useContext(PushNotificationContext);
    if (!context) {
        throw new Error('usePushNotifications must be used within a PushNotificationProvider');
    }
    return context;
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray as Uint8Array<ArrayBuffer>;
}

export const PushNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token, user } = useAuth();
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [settings, setSettings] = useState<NotificationSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
    const subscriptionRef = useRef<PushSubscription | null>(null);

    // Check if push notifications are supported
    useEffect(() => {
        const checkSupport = () => {
            const supported = 
                'serviceWorker' in navigator && 
                'PushManager' in window &&
                'Notification' in window;
            setIsSupported(supported);
            
            if (supported) {
                setPermission(Notification.permission);
            }
        };
        
        checkSupport();
    }, []);

    // Fetch VAPID public key
    useEffect(() => {
        const fetchVapidKey = async () => {
            try {
                // Use native fetch without auth interceptor
                const response = await window.fetch(`${API_URL}/notifications/vapid-public-key`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setVapidPublicKey(data.publicKey);
                } else {
                    console.warn('[Push] VAPID key fetch failed:', response.status);
                }
            } catch (error) {
                console.error('[Push] Error fetching VAPID key:', error);
            }
        };

        if (isSupported) {
            fetchVapidKey();
        }
    }, [isSupported]);

    // Check existing subscription, load settings, and auto-resubscribe if needed
    useEffect(() => {
        const checkSubscription = async () => {
            if (!isSupported || !token || !user) {
                setLoading(false);
                return;
            }

            try {
                // Add timeout for service worker ready
                const timeoutPromise = new Promise<null>((_, reject) => 
                    setTimeout(() => reject(new Error('Service worker timeout')), 10000)
                );

                const registration = await Promise.race([
                    navigator.serviceWorker.ready,
                    timeoutPromise
                ]) as ServiceWorkerRegistration;

                if (!registration) {
                    setLoading(false);
                    return;
                }

                const subscription = await registration.pushManager.getSubscription();
                subscriptionRef.current = subscription;

                // Check localStorage for previously enabled state
                const wasEnabled = localStorage.getItem(LS_PUSH_ENABLED) === 'true';
                const savedUserId = localStorage.getItem(LS_PUSH_USER_ID);
                const isSameUser = savedUserId === String(user.id);

                if (subscription) {
                    setIsSubscribed(true);
                    // Ensure localStorage is in sync
                    localStorage.setItem(LS_PUSH_ENABLED, 'true');
                    localStorage.setItem(LS_PUSH_USER_ID, String(user.id));

                    // Re-send subscription to server to ensure it's registered
                    // (handles case where server DB was reset or subscription expired)
                    try {
                        await fetch(`${API_URL}/notifications/subscribe`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                subscription: subscription.toJSON(),
                                userAgent: navigator.userAgent
                            })
                        });
                        console.log('[Push] Re-synced existing subscription to server');
                    } catch (e) {
                        console.warn('[Push] Failed to re-sync subscription:', e);
                    }
                } else if (wasEnabled && isSameUser) {
                    // User had notifications enabled but subscription was lost (SW update)
                    // Auto-resubscribe
                    console.log('[Push] Subscription lost after update, auto-resubscribing...');
                    setIsSubscribed(false);
                    // Will auto-subscribe after this effect completes
                    setTimeout(async () => {
                        try {
                            const result = await subscribeInternal(registration);
                            if (result) {
                                console.log('[Push] Auto-resubscribe successful');
                            } else {
                                console.warn('[Push] Auto-resubscribe failed');
                            }
                        } catch (e) {
                            console.error('[Push] Auto-resubscribe error:', e);
                        }
                    }, 1000);
                } else {
                    setIsSubscribed(false);
                }

                // Fetch settings
                const response = await fetch(`${API_URL}/notifications/settings`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setSettings(data);
                }
            } catch (error) {
                console.error('[Push] Error checking subscription:', error);
                // If check failed but localStorage says enabled, still try to subscribe
                const wasEnabled = localStorage.getItem(LS_PUSH_ENABLED) === 'true';
                const savedUserId = localStorage.getItem(LS_PUSH_USER_ID);
                if (wasEnabled && savedUserId === String(user.id)) {
                    console.log('[Push] Check failed, will retry subscription in background');
                    setTimeout(() => {
                        subscribe().catch(console.error);
                    }, 3000);
                }
            } finally {
                setLoading(false);
            }
        };

        checkSubscription();
    }, [isSupported, token, user]);

    // Auto-resubscribe when all dependencies become ready after update
    // This handles the race condition where vapidPublicKey isn't available yet
    // when the initial checkSubscription runs after an app update
    useEffect(() => {
        if (!isSupported || !vapidPublicKey || !token || !user || isSubscribed || loading) return;

        const wasEnabled = localStorage.getItem(LS_PUSH_ENABLED) === 'true';
        const savedUserId = localStorage.getItem(LS_PUSH_USER_ID);
        const isSameUser = savedUserId === String(user.id);

        if (wasEnabled && isSameUser) {
            console.log('[Push] All dependencies ready, attempting auto-resubscribe...');
            const attemptResubscribe = async (retries = 3) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        const registration = await navigator.serviceWorker.ready;
                        const existingSub = await registration.pushManager.getSubscription();
                        if (existingSub) {
                            // Already subscribed, just sync state
                            subscriptionRef.current = existingSub;
                            setIsSubscribed(true);
                            // Re-sync to server
                            await fetch(`${API_URL}/notifications/subscribe`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    subscription: existingSub.toJSON(),
                                    userAgent: navigator.userAgent
                                })
                            });
                            console.log('[Push] Auto-resubscribe: found existing subscription, synced');
                            return;
                        }

                        const result = await subscribeInternal(registration);
                        if (result) {
                            console.log('[Push] Auto-resubscribe successful (attempt', i + 1, ')');
                            return;
                        }
                    } catch (e) {
                        console.warn('[Push] Auto-resubscribe attempt', i + 1, 'failed:', e);
                    }
                    // Wait before retry (1s, 2s, 3s)
                    if (i < retries - 1) {
                        await new Promise(r => setTimeout(r, (i + 1) * 1000));
                    }
                }
                console.warn('[Push] Auto-resubscribe exhausted all retries');
            };

            // Small delay to ensure SW is fully ready
            const timer = setTimeout(() => attemptResubscribe(), 500);
            return () => clearTimeout(timer);
        }
    }, [isSupported, vapidPublicKey, token, user, isSubscribed, loading]);

    // Listen for service worker updates and re-check subscription
    useEffect(() => {
        if (!isSupported) return;

        const handleSWUpdate = async () => {
            console.log('[Push] Service worker updated, re-checking subscription...');
            // Small delay to let new SW activate
            setTimeout(async () => {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    const subscription = await registration.pushManager.getSubscription();
                    subscriptionRef.current = subscription;

                    if (subscription) {
                        setIsSubscribed(true);
                        // Re-sync to server
                        if (token) {
                            await fetch(`${API_URL}/notifications/subscribe`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    subscription: subscription.toJSON(),
                                    userAgent: navigator.userAgent
                                })
                            });
                        }
                    } else {
                        const wasEnabled = localStorage.getItem(LS_PUSH_ENABLED) === 'true';
                        if (wasEnabled && token && vapidPublicKey) {
                            console.log('[Push] Re-subscribing after SW update...');
                            const newSub = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                            });
                            subscriptionRef.current = newSub;
                            setIsSubscribed(true);

                            await fetch(`${API_URL}/notifications/subscribe`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    subscription: newSub.toJSON(),
                                    userAgent: navigator.userAgent
                                })
                            });
                            console.log('[Push] Re-subscribe after SW update successful');
                        }
                    }
                } catch (error) {
                    console.error('[Push] Error re-checking subscription after SW update:', error);
                }
            }, 2000);
        };

        // Listen for controlling SW change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', handleSWUpdate);

        // Listen for custom PWA resume event  
        window.addEventListener('pwa-resume', handleSWUpdate);

        return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleSWUpdate);
            window.removeEventListener('pwa-resume', handleSWUpdate);
        };
    }, [isSupported, token, vapidPublicKey]);

    // Listen for messages from service worker
    useEffect(() => {
        if (!isSupported) return;

        const handleMessage = (event: MessageEvent) => {
            console.log('[Push] Message from SW:', event.data);
            
            if (event.data?.type === 'NOTIFICATION_CLICK') {
                const data = event.data.data;
                
                // Handle different notification types using custom events
                // This allows the app to use React Router navigation + role-aware paths
                if ((data.type === 'chat' || (data.type === 'mention' && data.conversationId)) && data.conversationId) {
                    // Chat/mention in chat - open chat popup
                    window.dispatchEvent(new CustomEvent('openChatFromNotification', {
                        detail: { conversationId: data.conversationId }
                    }));
                } else if (data.type === 'discussion' && data.projectId) {
                    window.dispatchEvent(new CustomEvent('navigateFromNotification', {
                        detail: { type: 'project', projectId: data.projectId, tab: 'discussion' }
                    }));
                } else if (data.type === 'mention' && data.projectId) {
                    window.dispatchEvent(new CustomEvent('navigateFromNotification', {
                        detail: { type: 'project', projectId: data.projectId, tab: 'discussion' }
                    }));
                } else if (data.type === 'task' && data.projectId) {
                    window.dispatchEvent(new CustomEvent('navigateFromNotification', {
                        detail: { type: 'task', projectId: data.projectId }
                    }));
                } else if (data.type === 'task' && data.taskId) {
                    window.dispatchEvent(new CustomEvent('navigateFromNotification', {
                        detail: { type: 'task', taskId: data.taskId }
                    }));
                } else if (data.type === 'file' && data.projectId) {
                    window.dispatchEvent(new CustomEvent('navigateFromNotification', {
                        detail: { type: 'file', projectId: data.projectId }
                    }));
                } else if (data.type === 'result' && data.projectId) {
                    window.dispatchEvent(new CustomEvent('navigateFromNotification', {
                        detail: { type: 'result', projectId: data.projectId }
                    }));
                } else if (data.projectId) {
                    window.dispatchEvent(new CustomEvent('navigateFromNotification', {
                        detail: { type: 'project', projectId: data.projectId }
                    }));
                } else if (data.type === 'kanban') {
                    window.dispatchEvent(new CustomEvent('navigateFromNotification', {
                        detail: { type: 'kanban' }
                    }));
                } else if (data.taskId) {
                    window.dispatchEvent(new CustomEvent('navigateFromNotification', {
                        detail: { type: 'task', taskId: data.taskId }
                    }));
                }
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
    }, [isSupported]);

    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false;

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result === 'granted';
        } catch (error) {
            console.error('[Push] Error requesting permission:', error);
            return false;
        }
    }, [isSupported]);

    // Internal subscribe function that takes a registration (used for auto-resubscribe)
    const subscribeInternal = useCallback(async (registration?: ServiceWorkerRegistration): Promise<boolean> => {
        if (!isSupported || !vapidPublicKey || !token) {
            return false;
        }

        try {
            if (!registration) {
                const timeoutPromise = new Promise<null>((_, reject) => 
                    setTimeout(() => reject(new Error('Service worker timeout')), 10000)
                );
                registration = await Promise.race([
                    navigator.serviceWorker.ready,
                    timeoutPromise
                ]) as ServiceWorkerRegistration;
            }

            if (!registration) return false;

            // Check if already subscribed
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                });
            }

            subscriptionRef.current = subscription;

            const response = await fetch(`${API_URL}/notifications/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    userAgent: navigator.userAgent
                })
            });

            if (response.ok) {
                setIsSubscribed(true);
                // Persist to localStorage
                localStorage.setItem(LS_PUSH_ENABLED, 'true');
                if (user) {
                    localStorage.setItem(LS_PUSH_USER_ID, String(user.id));
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('[Push] Internal subscribe error:', error);
            return false;
        }
    }, [isSupported, vapidPublicKey, token, user]);

    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !vapidPublicKey || !token) {
            setError('Push notifications không được hỗ trợ');
            return false;
        }

        try {
            setLoading(true);
            setError(null);

            // Request permission if needed
            if (permission !== 'granted') {
                const granted = await requestPermission();
                if (!granted) {
                    setError('Quyền thông báo bị từ chối');
                    return false;
                }
            }

            const result = await subscribeInternal();
            if (!result) {
                throw new Error('Failed to subscribe');
            }
            return true;
        } catch (error: any) {
            console.error('[Push] Error subscribing:', error);
            setError(error.message || 'Không thể đăng ký thông báo');
            return false;
        } finally {
            setLoading(false);
        }
    }, [isSupported, vapidPublicKey, token, permission, requestPermission, subscribeInternal]);

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        if (!subscriptionRef.current || !token) return false;

        try {
            setLoading(true);
            
            const endpoint = subscriptionRef.current.endpoint;
            await subscriptionRef.current.unsubscribe();

            // Notify server
            await fetch(`${API_URL}/notifications/unsubscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ endpoint })
            });

            subscriptionRef.current = null;
            setIsSubscribed(false);
            // Clear localStorage persistence
            localStorage.removeItem(LS_PUSH_ENABLED);
            localStorage.removeItem(LS_PUSH_USER_ID);
            return true;
        } catch (error) {
            console.error('[Push] Error unsubscribing:', error);
            return false;
        } finally {
            setLoading(false);
        }
    }, [token]);

    const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/notifications/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(newSettings)
            });

            if (response.ok) {
                const updated = await response.json();
                setSettings(updated);
            }
        } catch (error) {
            console.error('[Push] Error updating settings:', error);
        }
    }, [token]);

    const sendTestNotification = useCallback(async () => {
        if (!token) return;

        try {
            await fetch(`${API_URL}/notifications/test`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error('[Push] Error sending test:', error);
        }
    }, [token]);

    const value: PushNotificationContextType = {
        isSupported,
        isSubscribed,
        permission,
        settings: settings || defaultSettings,
        loading,
        error,
        subscribe,
        unsubscribe,
        requestPermission,
        updateSettings,
        sendTestNotification
    };

    return (
        <PushNotificationContext.Provider value={value}>
            {children}
        </PushNotificationContext.Provider>
    );
};

export default PushNotificationContext;
