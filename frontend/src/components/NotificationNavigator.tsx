import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Component that handles navigation from push notification clicks.
 * - Listens for 'navigateFromNotification' custom events (from PushNotificationContext)
 * - Handles URL query params on fresh app load (from SW openWindow)
 * Must be placed inside BrowserRouter.
 */
const NotificationNavigator = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const getPrefix = () => (user?.role === 'ADMIN' ? '/admin' : '');

    // Handle navigateFromNotification events (when app is already open)
    useEffect(() => {
        const handleNavigate = (event: Event) => {
            const { detail } = event as CustomEvent<{
                type: string;
                projectId?: number;
                taskId?: number;
                tab?: string;
            }>;

            const prefix = getPrefix();

            if (detail.type === 'project' && detail.projectId) {
                const tabParam = detail.tab ? `?tab=${detail.tab}` : '';
                navigate(`${prefix}/projects/${detail.projectId}${tabParam}`);
            } else if (detail.type === 'discussion' && detail.projectId) {
                navigate(`${prefix}/projects/${detail.projectId}?tab=discussion`);
            } else if (detail.type === 'task' && detail.projectId) {
                navigate(`${prefix}/projects/${detail.projectId}?tab=tasks`);
            } else if (detail.type === 'task' && detail.taskId) {
                navigate(prefix ? `${prefix}/my-tasks` : '/my-tasks');
            } else if (detail.type === 'file' && detail.projectId) {
                navigate(`${prefix}/projects/${detail.projectId}?tab=attachments`);
            } else if (detail.type === 'result' && detail.projectId) {
                navigate(`${prefix}/projects/${detail.projectId}?tab=results`);
            } else if (detail.type === 'activity') {
                // Kanban and other activity notifications → kanban page
                navigate(`${prefix}/kanban`);
            } else if (detail.type === 'mention' && detail.projectId) {
                navigate(`${prefix}/projects/${detail.projectId}?tab=discussion`);
            } else if (detail.type === 'chat') {
                // Chat notifications → home (chat is a popup)
                navigate(`${prefix}/`);
            }
        };

        window.addEventListener('navigateFromNotification', handleNavigate);
        return () => {
            window.removeEventListener('navigateFromNotification', handleNavigate);
        };
    }, [navigate, user]);

    // Handle URL params on fresh app load (from SW clients.openWindow)
    useEffect(() => {
        if (!user) return;

        const notificationType = searchParams.get('notificationType');
        if (!notificationType) return;

        const projectId = searchParams.get('projectId');
        const taskId = searchParams.get('taskId');
        const prefix = getPrefix();

        // Clean up the URL params
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('notificationType');
        newParams.delete('projectId');
        newParams.delete('taskId');
        newParams.delete('tab');
        setSearchParams(newParams, { replace: true });

        // Navigate after a small delay to ensure app is fully loaded
        setTimeout(() => {
            if (notificationType === 'project' && projectId) {
                const tab = searchParams.get('tab');
                const tabParam = tab ? `?tab=${tab}` : '';
                navigate(`${prefix}/projects/${projectId}${tabParam}`, { replace: true });
            } else if (notificationType === 'discussion' && projectId) {
                navigate(`${prefix}/projects/${projectId}?tab=discussion`, { replace: true });
            } else if (notificationType === 'mention' && projectId) {
                navigate(`${prefix}/projects/${projectId}?tab=discussion`, { replace: true });
            } else if (notificationType === 'task' && projectId) {
                navigate(`${prefix}/projects/${projectId}?tab=tasks`, { replace: true });
            } else if (notificationType === 'task' && taskId) {
                navigate(prefix ? `${prefix}/my-tasks` : '/my-tasks', { replace: true });
            } else if (notificationType === 'file' && projectId) {
                navigate(`${prefix}/projects/${projectId}?tab=attachments`, { replace: true });
            } else if (notificationType === 'result' && projectId) {
                navigate(`${prefix}/projects/${projectId}?tab=results`, { replace: true });
            } else if (notificationType === 'activity') {
                // Kanban and other activity notifications → kanban page
                navigate(`${prefix}/kanban`, { replace: true });
            } else if (notificationType === 'chat') {
                // Chat notifications → home
                navigate(`${prefix}/`, { replace: true });
            }
        }, 300);
    }, [user, searchParams]);

    return null; // This is a behavior-only component
};

export default NotificationNavigator;
