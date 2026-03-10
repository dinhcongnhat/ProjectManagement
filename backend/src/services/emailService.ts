import { Resend } from 'resend';

// Resend configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_M5baQ9Xp_7LkT5zHyNY3NwotRbnWh3pKF';
const FROM_EMAIL = process.env.FROM_EMAIL || 'JTSC Project <noreply@jtsc.vn>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://jtsc.io.vn';
const LOGO_URL = `${FRONTEND_URL}/Logo.png`;

// Initialize Resend
const resend = new Resend(RESEND_API_KEY);

// Rate limiting: Resend allows max 2 requests/second
let lastEmailSentAt = 0;
const RATE_LIMIT_DELAY_MS = 600; // 600ms between emails to stay under 2 req/sec

const waitForRateLimit = async (): Promise<void> => {
    const now = Date.now();
    const elapsed = now - lastEmailSentAt;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
        const waitTime = RATE_LIMIT_DELAY_MS - elapsed;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastEmailSentAt = Date.now();
};

console.log('[EmailService] Initialized with domain: jtsc.vn');
console.log(`[EmailService] API Key: ${RESEND_API_KEY ? RESEND_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
console.log(`[EmailService] From: ${FROM_EMAIL}`);

// ==================== EMAIL TEMPLATES ====================

// Project Assignment Email Template
const getProjectAssignmentEmailHtml = (
    userName: string,
    projectName: string,
    projectCode: string,
    role: 'manager' | 'implementer' | 'follower' | 'cooperator',
    assignerName: string,
    startDate: string | null,
    endDate: string | null,
    description: string | null,
    projectUrl: string
): string => {
    const roleText = {
        manager: 'Quản lý dự án',
        implementer: 'Người thực hiện',
        follower: 'Người theo dõi',
        cooperator: 'Người phối hợp'
    };

    const roleColor = {
        manager: '#e74c3c',
        implementer: '#3498db',
        follower: '#27ae60',
        cooperator: '#f59e0b'
    };

    const roleDescription = {
        manager: 'Với vai trò Quản lý dự án, bạn sẽ chịu trách nhiệm giám sát tiến độ, phân công công việc và đảm bảo dự án hoàn thành đúng hạn.',
        implementer: 'Với vai trò Người thực hiện, bạn sẽ trực tiếp tham gia triển khai các công việc được giao trong dự án này.',
        follower: 'Với vai trò Người theo dõi, bạn sẽ được cập nhật thông tin và có thể theo dõi tiến độ của dự án.',
        cooperator: 'Với vai trò Người phối hợp, bạn sẽ hỗ trợ và phối hợp với nhóm thực hiện trong dự án này.'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thông báo phân công dự án</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f2f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                    <!-- Header with Logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 35px 40px; text-align: center;">
                            <img src="${LOGO_URL}" alt="JTSC Logo" style="height: 50px; margin-bottom: 15px;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">
                                THÔNG BÁO PHÂN CÔNG DỰ ÁN
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 45px;">
                            <p style="color: #1e293b; font-size: 16px; line-height: 1.7; margin: 0 0 25px;">
                                Kính gửi <strong>${userName}</strong>,
                            </p>
                            
                            <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 25px;">
                                Hệ thống JTSC xin thông báo <strong>${assignerName}</strong> đã phân công bạn tham gia dự án mới với vai trò:
                            </p>
                            
                            <!-- Role Badge -->
                            <div style="text-align: center; margin-bottom: 25px;">
                                <span style="display: inline-block; padding: 12px 30px; background-color: ${roleColor[role]}; color: white; border-radius: 30px; font-weight: 600; font-size: 15px; text-transform: uppercase; letter-spacing: 1px;">
                                    ${roleText[role]}
                                </span>
                            </div>

                            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 30px; text-align: center; font-style: italic;">
                                ${roleDescription[role]}
                            </p>
                            
                            <!-- Project Card -->
                            <div style="background-color: #f8fafc; border-radius: 12px; padding: 28px; border-left: 5px solid ${roleColor[role]}; margin-bottom: 30px;">
                                <h2 style="color: #1e293b; margin: 0 0 18px; font-size: 20px; font-weight: 600;">
                                    📁 ${projectName}
                                </h2>
                                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                        <td style="color: #64748b; padding: 6px 0; font-size: 14px; width: 120px;"><strong>Mã dự án:</strong></td>
                                        <td style="color: #334155; padding: 6px 0; font-size: 14px;">${projectCode}</td>
                                    </tr>
                                    ${startDate ? `
                                    <tr>
                                        <td style="color: #64748b; padding: 6px 0; font-size: 14px;"><strong>Ngày bắt đầu:</strong></td>
                                        <td style="color: #334155; padding: 6px 0; font-size: 14px;">${startDate}</td>
                                    </tr>
                                    ` : ''}
                                    ${endDate ? `
                                    <tr>
                                        <td style="color: #64748b; padding: 6px 0; font-size: 14px;"><strong>Ngày kết thúc:</strong></td>
                                        <td style="color: #334155; padding: 6px 0; font-size: 14px;">${endDate}</td>
                                    </tr>
                                    ` : ''}
                                </table>
                                ${description ? `
                                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #64748b; margin: 0 0 5px; font-size: 14px;"><strong>Mô tả:</strong></p>
                                    <p style="color: #475569; margin: 0; font-size: 14px; line-height: 1.6;">${description}</p>
                                </div>
                                ` : ''}
                            </div>
                            
                            <!-- CTA Button -->
                            <div style="text-align: center;">
                                <a href="${projectUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);">
                                    XEM CHI TIẾT DỰ ÁN →
                                </a>
                            </div>

                            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                                Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ với quản lý dự án trong phần nhắn tin.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1e293b; padding: 30px 40px; text-align: center;">
                            <img src="${LOGO_URL}" alt="JTSC" style="height: 35px; margin-bottom: 15px; opacity: 0.9;">
                            <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px; line-height: 1.5;">
                                Email này được gửi tự động từ hệ thống JTSC Project Management
                            </p>
                            <p style="color: #64748b; font-size: 12px; margin: 0;">
                                © ${new Date().getFullYear()} JTSC. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
};

// Deadline Reminder Email Template
const getDeadlineReminderEmailHtml = (
    userName: string,
    projectName: string,
    projectCode: string,
    endDate: string,
    daysRemaining: number,
    isOverdue: boolean,
    projectUrl: string
): string => {
    const statusColor = isOverdue ? '#dc2626' : (daysRemaining <= 1 ? '#f59e0b' : '#16a34a');
    const statusBgColor = isOverdue ? '#fef2f2' : (daysRemaining <= 1 ? '#fffbeb' : '#f0fdf4');
    const statusBorderColor = isOverdue ? '#fecaca' : (daysRemaining <= 1 ? '#fde68a' : '#bbf7d0');

    const statusText = isOverdue
        ? `Quá hạn ${Math.abs(daysRemaining)} ngày`
        : daysRemaining === 0
            ? 'Deadline hôm nay'
            : daysRemaining === 1
                ? 'Deadline ngày mai'
                : `Còn ${daysRemaining} ngày`;

    const urgencyMessage = isOverdue
        ? 'Dự án này đã vượt quá thời hạn hoàn thành. Vui lòng cập nhật tiến độ ngay hoặc liên hệ với quản lý để xin gia hạn nếu cần thiết.'
        : daysRemaining <= 1
            ? 'Thời hạn hoàn thành dự án đang đến gần. Vui lòng đảm bảo tiến độ công việc theo kế hoạch.'
            : 'Đây là thông báo nhắc nhở về tiến độ dự án. Vui lòng kiểm tra và cập nhật trạng thái công việc.';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thông báo Deadline Dự Án</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f2f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                    <!-- Header with Logo -->
                    <tr>
                        <td style="background: ${isOverdue ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'}; padding: 35px 40px; text-align: center;">
                            <img src="${LOGO_URL}" alt="JTSC Logo" style="height: 50px; margin-bottom: 15px;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">
                                ${isOverdue ? '⚠️ CẢNH BÁO DỰ ÁN QUÁ HẠN' : '📅 NHẮC NHỞ DEADLINE DỰ ÁN'}
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 45px;">
                            <p style="color: #1e293b; font-size: 16px; line-height: 1.7; margin: 0 0 25px;">
                                Kính gửi <strong>${userName}</strong>,
                            </p>
                            
                            <!-- Status Badge -->
                            <div style="text-align: center; margin-bottom: 25px;">
                                <span style="display: inline-block; padding: 14px 35px; background-color: ${statusColor}; color: white; border-radius: 30px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                                    ${statusText}
                                </span>
                            </div>

                            <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 30px; text-align: center;">
                                ${urgencyMessage}
                            </p>
                            
                            <!-- Project Card -->
                            <div style="background-color: #f8fafc; border-radius: 12px; padding: 28px; border-left: 5px solid ${statusColor}; margin-bottom: 25px;">
                                <h2 style="color: #1e293b; margin: 0 0 18px; font-size: 20px; font-weight: 600;">
                                    📁 ${projectName}
                                </h2>
                                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                        <td style="color: #64748b; padding: 6px 0; font-size: 14px; width: 120px;"><strong>Mã dự án:</strong></td>
                                        <td style="color: #334155; padding: 6px 0; font-size: 14px;">${projectCode}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #64748b; padding: 6px 0; font-size: 14px;"><strong>Deadline:</strong></td>
                                        <td style="color: ${statusColor}; padding: 6px 0; font-size: 14px; font-weight: 700;">${endDate}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            ${isOverdue ? `
                            <!-- Warning Box -->
                            <div style="background-color: ${statusBgColor}; border-radius: 10px; padding: 18px 22px; margin-bottom: 25px; border: 1px solid ${statusBorderColor};">
                                <p style="color: #991b1b; margin: 0; font-size: 14px; line-height: 1.6;">
                                    <strong>⚡ Hành động cần thiết:</strong> Vui lòng cập nhật tiến độ dự án ngay lập tức và thông báo cho quản lý về tình trạng công việc hiện tại.
                                </p>
                            </div>
                            ` : ''}
                            
                            <!-- CTA Button -->
                            <div style="text-align: center;">
                                <a href="${projectUrl}" style="display: inline-block; padding: 16px 40px; background: ${isOverdue ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'}; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 15px ${isOverdue ? 'rgba(220, 38, 38, 0.4)' : 'rgba(59, 130, 246, 0.4)'};">
                                    CẬP NHẬT TIẾN ĐỘ →
                                </a>
                            </div>

                            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                                Nếu bạn cần hỗ trợ, vui lòng liên hệ với quản lý dự án hoặc phòng Điều phối.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1e293b; padding: 30px 40px; text-align: center;">
                            <img src="${LOGO_URL}" alt="JTSC" style="height: 35px; margin-bottom: 15px; opacity: 0.9;">
                            <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px; line-height: 1.5;">
                                Email này được gửi tự động từ hệ thống JTSC Project Management
                            </p>
                            <p style="color: #64748b; font-size: 12px; margin: 0;">
                                © ${new Date().getFullYear()} JTSC. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
};

// ==================== EMAIL SENDING FUNCTIONS ====================

// Send project assignment email
export const sendProjectAssignmentEmail = async (
    toEmail: string,
    userName: string,
    projectId: number,
    projectName: string,
    projectCode: string,
    role: 'manager' | 'implementer' | 'follower' | 'cooperator',
    assignerName: string,
    startDate: Date | null,
    endDate: Date | null,
    description: string | null
): Promise<boolean> => {
    if (!toEmail) {
        console.log('[EmailService] No email address provided, skipping...');
        return false;
    }

    try {
        const projectUrl = `${FRONTEND_URL}/projects/${projectId}`;
        const formatDate = (date: Date | null) => date ? date.toLocaleDateString('vi-VN') : null;

        const roleText = {
            manager: 'Quản lý',
            implementer: 'Thực hiện',
            follower: 'Theo dõi',
            cooperator: 'Phối hợp'
        };

        await waitForRateLimit();
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject: `[JTSC] Bạn được phân công ${roleText[role]} dự án: ${projectName}`,
            html: getProjectAssignmentEmailHtml(
                userName,
                projectName,
                projectCode,
                role,
                assignerName,
                formatDate(startDate),
                formatDate(endDate),
                description,
                projectUrl
            )
        });

        if (error) {
            console.error('[EmailService] Failed to send project assignment email:', error);
            return false;
        }

        console.log(`[EmailService] Project assignment email sent to ${toEmail}, ID: ${data?.id}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Error sending project assignment email:', error);
        return false;
    }
};

// Send deadline reminder email
export const sendDeadlineReminderEmail = async (
    toEmail: string,
    userName: string,
    projectId: number,
    projectName: string,
    projectCode: string,
    endDate: Date,
    daysRemaining: number,
    isOverdue: boolean
): Promise<boolean> => {
    if (!toEmail) {
        console.log('[EmailService] No email address provided, skipping...');
        return false;
    }

    try {
        const projectUrl = `${FRONTEND_URL}/projects/${projectId}`;
        const formattedEndDate = endDate.toLocaleDateString('vi-VN');

        const subject = isOverdue
            ? `[CẢNH BÁO] Dự án "${projectName}" đã quá hạn ${Math.abs(daysRemaining)} ngày!`
            : daysRemaining <= 1
                ? `[NHẮC NHỞ] Dự án "${projectName}" sắp đến deadline!`
                : `[NHẮC NHỞ] Dự án "${projectName}" còn ${daysRemaining} ngày`;

        await waitForRateLimit();
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject,
            html: getDeadlineReminderEmailHtml(
                userName,
                projectName,
                projectCode,
                formattedEndDate,
                daysRemaining,
                isOverdue,
                projectUrl
            )
        });

        if (error) {
            console.error('[EmailService] Failed to send deadline reminder email:', error);
            return false;
        }

        console.log(`[EmailService] Deadline reminder email sent to ${toEmail}, ID: ${data?.id}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Error sending deadline reminder email:', error);
        return false;
    }
};

// Send test email
export const sendTestEmail = async (toEmail: string): Promise<boolean> => {
    try {
        await waitForRateLimit();
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject: '✅ Xác nhận cấu hình email - JTSC Project Management',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f2f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="500" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 35px 40px; text-align: center;">
                            <img src="${LOGO_URL}" alt="JTSC Logo" style="height: 50px; margin-bottom: 15px;">
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 35px; text-align: center;">
                            <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; margin: 0 auto 25px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                                <span style="font-size: 35px; line-height: 70px;">✓</span>
                            </div>
                            <h1 style="color: #1e293b; margin: 0 0 20px; font-size: 24px; font-weight: 600;">
                                Cấu hình thành công!
                            </h1>
                            <p style="color: #64748b; font-size: 15px; line-height: 1.7; margin: 0 0 30px;">
                                Hệ thống gửi email của JTSC Project Management đã được thiết lập và hoạt động bình thường. Bạn sẽ nhận được thông báo qua email khi:
                            </p>
                            
                            <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 25px;">
                                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding: 8px 0; color: #475569; font-size: 14px;">
                                            📋 Được phân công dự án mới
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #475569; font-size: 14px;">
                                            ⏰ Dự án sắp đến deadline
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #475569; font-size: 14px;">
                                            ⚠️ Dự án quá hạn cần xử lý
                                        </td>
                                    </tr>
                                </table>
                            </div>

                            <a href="${FRONTEND_URL}" style="display: inline-block; padding: 14px 35px; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);">
                                TRUY CẬP HỆ THỐNG
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1e293b; padding: 25px 35px; text-align: center;">
                            <p style="color: #94a3b8; font-size: 12px; margin: 0 0 5px;">
                                Thời gian gửi: ${new Date().toLocaleString('vi-VN')}
                            </p>
                            <p style="color: #64748b; font-size: 11px; margin: 0;">
                                © ${new Date().getFullYear()} JTSC. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `
        });

        if (error) {
            console.error('[EmailService] Test email failed:', error);
            return false;
        }

        console.log(`[EmailService] Test email sent to ${toEmail}, ID: ${data?.id}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Error sending test email:', error);
        return false;
    }
};

// Send task reminder email
export const sendTaskReminderEmail = async (
    toEmail: string,
    userName: string,
    taskId: number,
    taskTitle: string,
    reminderAt: Date
): Promise<boolean> => {
    if (!toEmail) return false;

    try {
        const taskUrl = `${FRONTEND_URL}/my-tasks`;
        const formattedDate = reminderAt.toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
        });

        await waitForRateLimit();
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject: `[NHẮC NHỞ] Công việc "${taskTitle}"`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nhắc nhở công việc</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f2f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 35px 40px; text-align: center;">
                            <img src="${LOGO_URL}" alt="JTSC Logo" style="height: 50px; margin-bottom: 15px;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">
                                🔔 NHẮC NHỞ CÔNG VIỆC
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 45px;">
                            <p style="color: #1e293b; font-size: 16px; line-height: 1.7; margin: 0 0 25px;">
                                Kính gửi <strong>${userName}</strong>,
                            </p>
                            
                            <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 25px;">
                                Đây là thông báo nhắc nhở cho công việc bạn đã đặt lịch:
                            </p>
                            
                            <!-- Task Card -->
                            <div style="background-color: #fffbeb; border-radius: 12px; padding: 28px; border-left: 5px solid #f59e0b; margin-bottom: 25px;">
                                <h2 style="color: #1e293b; margin: 0 0 15px; font-size: 18px; font-weight: 600;">
                                    📌 ${taskTitle}
                                </h2>
                                <p style="color: #b45309; margin: 0; font-size: 14px; font-weight: 500;">
                                    ⏰ Thời gian: ${formattedDate}
                                </p>
                            </div>
                            
                            <!-- CTA Button -->
                            <div style="text-align: center;">
                                <a href="${taskUrl}" style="display: inline-block; padding: 14px 35px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">
                                    XEM CÔNG VIỆC →
                                </a>
                            </div>
                            
                            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                                Nếu bạn đã hoàn thành công việc này, hãy đánh dấu hoàn thành trên hệ thống.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1e293b; padding: 25px 35px; text-align: center;">
                            <p style="color: #64748b; font-size: 11px; margin: 0;">
                                © ${new Date().getFullYear()} JTSC. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `
        });

        if (error) {
            console.error('[EmailService] Failed to send task reminder email:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[EmailService] Error sending task reminder email:', error);
        return false;
    }
};

// Send task deadline email (overdue or upcoming)
export const sendTaskDeadlineEmail = async (
    toEmail: string,
    userName: string,
    taskId: number,
    taskTitle: string,
    endDate: Date,
    daysRemaining: number,
    isOverdue: boolean
): Promise<boolean> => {
    if (!toEmail) {
        console.log('[EmailService] No email address provided for task deadline, skipping...');
        return false;
    }

    try {
        const taskUrl = `${FRONTEND_URL}/my-tasks`;
        const formattedEndDate = endDate.toLocaleDateString('vi-VN');

        const statusColor = isOverdue ? '#dc2626' : '#f59e0b';
        const statusText = isOverdue
            ? `Quá hạn ${Math.abs(daysRemaining)} ngày`
            : daysRemaining === 0
                ? 'Deadline hôm nay'
                : daysRemaining === 1
                    ? 'Deadline ngày mai'
                    : `Còn ${daysRemaining} ngày`;

        const subject = isOverdue
            ? `[CẢNH BÁO] Công việc "${taskTitle}" đã quá hạn ${Math.abs(daysRemaining)} ngày!`
            : `[NHẮC NHỞ] Công việc "${taskTitle}" sắp đến hạn!`;

        await waitForRateLimit();
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thông báo công việc</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f2f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: ${isOverdue ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; padding: 35px 40px; text-align: center;">
                            <img src="${LOGO_URL}" alt="JTSC Logo" style="height: 50px; margin-bottom: 15px;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">
                                ${isOverdue ? '⚠️ CÔNG VIỆC QUÁ HẠN' : '📅 NHẮC NHỞ CÔNG VIỆC'}
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 45px;">
                            <p style="color: #1e293b; font-size: 16px; line-height: 1.7; margin: 0 0 25px;">
                                Kính gửi <strong>${userName}</strong>,
                            </p>
                            <div style="text-align: center; margin-bottom: 25px;">
                                <span style="display: inline-block; padding: 14px 35px; background-color: ${statusColor}; color: white; border-radius: 30px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                                    ${statusText}
                                </span>
                            </div>
                            <div style="background-color: ${isOverdue ? '#fef2f2' : '#fffbeb'}; border-radius: 12px; padding: 28px; border-left: 5px solid ${statusColor}; margin-bottom: 25px;">
                                <h2 style="color: #1e293b; margin: 0 0 15px; font-size: 18px; font-weight: 600;">
                                    📌 ${taskTitle}
                                </h2>
                                <p style="color: ${statusColor}; margin: 0; font-size: 14px; font-weight: 600;">
                                    📅 Deadline: ${formattedEndDate}
                                </p>
                            </div>
                            <div style="text-align: center;">
                                <a href="${taskUrl}" style="display: inline-block; padding: 14px 35px; background: ${isOverdue ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 4px 15px ${isOverdue ? 'rgba(220, 38, 38, 0.4)' : 'rgba(245, 158, 11, 0.4)'};">
                                    XEM CÔNG VIỆC →
                                </a>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #1e293b; padding: 25px 35px; text-align: center;">
                            <p style="color: #64748b; font-size: 11px; margin: 0;">
                                © ${new Date().getFullYear()} JTSC. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `
        });

        if (error) {
            console.error('[EmailService] Failed to send task deadline email:', error);
            return false;
        }

        console.log(`[EmailService] Task deadline email sent to ${toEmail}, ID: ${data?.id}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Error sending task deadline email:', error);
        return false;
    }
};

// Send kanban daily reminder email (consolidated - one email per member)
export const sendKanbanDailyReminderEmail = async (
    toEmail: string,
    userName: string,
    boards: { boardName: string; cards: { title: string; listName: string; dueDate: string | null }[] }[]
): Promise<boolean> => {
    if (!toEmail) return false;

    try {
        const totalCards = boards.reduce((sum, b) => sum + b.cards.length, 0);
        const today = new Date();
        const dateStr = today.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });

        const boardListHtml = boards.map(b => {
            const overdueCards = b.cards.filter(c => c.dueDate && new Date(c.dueDate) < today);
            const upcomingCards = b.cards.filter(c => !c.dueDate || new Date(c.dueDate) >= today);

            return `
            <div style="margin-bottom: 28px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 12px 16px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 10px 10px 0 0;">
                            <h3 style="color: #ffffff; font-size: 15px; margin: 0; font-weight: 700; letter-spacing: 0.3px;">
                                📌 ${b.boardName}
                            </h3>
                            <p style="color: rgba(255,255,255,0.85); font-size: 12px; margin: 4px 0 0;">
                                ${b.cards.length} công việc chưa hoàn thành${overdueCards.length > 0 ? ` · <span style="color: #fbbf24;">${overdueCards.length} quá hạn</span>` : ''}
                            </p>
                        </td>
                    </tr>
                </table>
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; overflow: hidden;">
                    <tr style="background-color: #f1f5f9;">
                        <td style="padding: 8px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 45%;">
                            Công việc
                        </td>
                        <td style="padding: 8px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 30%;">
                            Trạng thái
                        </td>
                        <td style="padding: 8px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 25%; text-align: right;">
                            Deadline
                        </td>
                    </tr>
                    ${b.cards.map((c, i) => {
                const isOverdue = c.dueDate && new Date(c.dueDate) < today;
                const dueDateFormatted = c.dueDate
                    ? new Date(c.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
                    : '—';
                return `
                        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                            <td style="padding: 10px 14px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #f1f5f9; font-weight: 500;">
                                ${isOverdue ? '🔴' : '🔵'} ${c.title}
                            </td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9;">
                                <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; ${c.listName.toLowerCase().includes('cần làm') ? 'background-color: #fef3c7; color: #92400e;' :
                        c.listName.toLowerCase().includes('đang làm') ? 'background-color: #dbeafe; color: #1e40af;' :
                            c.listName.toLowerCase().includes('review') ? 'background-color: #ede9fe; color: #5b21b6;' :
                                'background-color: #f1f5f9; color: #475569;'
                    }">
                                    ${c.listName}
                                </span>
                            </td>
                            <td style="padding: 10px 14px; font-size: 12px; color: ${isOverdue ? '#dc2626' : '#64748b'}; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: ${isOverdue ? '700' : '400'};">
                                ${isOverdue ? '⚠️ ' : ''}${dueDateFormatted}
                            </td>
                        </tr>`;
            }).join('')}
                </table>
            </div>`;
        }).join('');

        await waitForRateLimit();
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject: `📋 [Nhắc nhở hàng ngày] Bạn có ${totalCards} công việc Kanban chưa hoàn thành`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nhắc nhở Kanban hàng ngày</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f2f5; -webkit-font-smoothing: antialiased;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f2f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="620" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08);">
                    
                    <!-- Header with gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #06b6d4 100%); padding: 40px 45px; text-align: center;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <img src="${LOGO_URL}" alt="JTSC Logo" style="height: 55px; margin-bottom: 18px; filter: brightness(10);">
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                            📋 BÁO CÁO CÔNG VIỆC HÀNG NGÀY
                                        </h1>
                                        <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 10px 0 0; font-weight: 400;">
                                            ${dateStr}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Summary Stats -->
                    <tr>
                        <td style="padding: 0 45px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: -25px;">
                                <tr>
                                    <td align="center">
                                        <table cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
                                            <tr>
                                                <td style="padding: 18px 30px; text-align: center; border-right: 1px solid #f1f5f9;">
                                                    <div style="font-size: 28px; font-weight: 800; color: #1e3a8a;">${totalCards}</div>
                                                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Công việc</div>
                                                </td>
                                                <td style="padding: 18px 30px; text-align: center; border-right: 1px solid #f1f5f9;">
                                                    <div style="font-size: 28px; font-weight: 800; color: #7c3aed;">${boards.length}</div>
                                                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Bảng</div>
                                                </td>
                                                <td style="padding: 18px 30px; text-align: center;">
                                                    <div style="font-size: 28px; font-weight: 800; color: #dc2626;">${boards.reduce((sum, b) => sum + b.cards.filter(c => c.dueDate && new Date(c.dueDate) < today).length, 0)}</div>
                                                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Quá hạn</div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 35px 45px 20px;">
                            <p style="color: #1e293b; font-size: 16px; line-height: 1.7; margin: 0 0 8px;">
                                Xin chào <strong>${userName}</strong>,
                            </p>
                            
                            <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 30px;">
                                Dưới đây là tổng hợp các công việc Kanban chưa hoàn thành của bạn. Hãy ưu tiên xử lý các công việc quá hạn trước nhé!
                            </p>
                            
                            ${boardListHtml}
                            
                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 30px 0 10px;">
                                <a href="${FRONTEND_URL}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35); transition: all 0.2s;">
                                    MỞ BẢNG KANBAN →
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0f172a; padding: 30px 40px; text-align: center;">
                            <img src="${LOGO_URL}" alt="JTSC" style="height: 30px; margin-bottom: 12px; opacity: 0.7;">
                            <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0 0 6px;">
                                Thông báo này được gửi tự động lúc 8:00 AM mỗi ngày làm việc.
                            </p>
                            <p style="color: #475569; font-size: 11px; margin: 0;">
                                © ${new Date().getFullYear()} JTSC Project Management. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Unsubscribe hint -->
                <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 20px;">
                    Bạn nhận email này vì bạn là thành viên của nhóm làm việc trên JTSC Project.<br>
                    Để tắt thông báo, vào <a href="${FRONTEND_URL}" style="color: #3b82f6; text-decoration: none;">Cài đặt thông báo</a> trong ứng dụng.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
            `
        });

        if (error) {
            console.error('[EmailService] Failed to send kanban reminder email:', error);
            return false;
        }

        console.log(`[EmailService] Kanban reminder email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Error sending kanban reminder email:', error);
        return false;
    }
};

// Send personal tasks daily reminder email (consolidated)
export const sendPersonalTasksDailyReminderEmail = async (
    toEmail: string,
    userName: string,
    tasks: { title: string; dueDate: string | null; status: string }[]
): Promise<boolean> => {
    if (!toEmail) return false;

    try {
        const totalTasks = tasks.length;
        const today = new Date();
        const dateStr = today.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });

        const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < today);

        const taskListHtml = `
            <div style="margin-bottom: 28px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 12px 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px 10px 0 0;">
                            <h3 style="color: #ffffff; font-size: 15px; margin: 0; font-weight: 700; letter-spacing: 0.3px;">
                                📌 Công việc cá nhân
                            </h3>
                            <p style="color: rgba(255,255,255,0.85); font-size: 12px; margin: 4px 0 0;">
                                ${tasks.length} công việc chưa hoàn thành${overdueTasks.length > 0 ? ` · <span style="color: #fbbf24;">${overdueTasks.length} quá hạn</span>` : ''}
                            </p>
                        </td>
                    </tr>
                </table>
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; overflow: hidden;">
                    <tr style="background-color: #f1f5f9;">
                        <td style="padding: 8px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 45%;">
                            Công việc
                        </td>
                        <td style="padding: 8px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 30%;">
                            Trạng thái
                        </td>
                        <td style="padding: 8px 14px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 25%; text-align: right;">
                            Deadline
                        </td>
                    </tr>
                    ${tasks.map((t, i) => {
            const isOverdue = t.dueDate && new Date(t.dueDate) < today;
            const dueDateFormatted = t.dueDate
                ? new Date(t.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
                : '—';
            return `
                        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                            <td style="padding: 10px 14px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #f1f5f9; font-weight: 500;">
                                ${isOverdue ? '🔴' : '🔵'} ${t.title}
                            </td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9;">
                                <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; ${t.status === 'TODO' ? 'background-color: #fef3c7; color: #92400e;' :
                    t.status === 'IN_PROGRESS' ? 'background-color: #dbeafe; color: #1e40af;' :
                        t.status === 'REVIEW' ? 'background-color: #ede9fe; color: #5b21b6;' :
                            'background-color: #f1f5f9; color: #475569;'
                }">
                                    ${t.status === 'TODO' ? 'Cần làm' : t.status === 'IN_PROGRESS' ? 'Đang làm' : t.status === 'REVIEW' ? 'Cần review' : t.status}
                                </span>
                            </td>
                            <td style="padding: 10px 14px; font-size: 12px; color: ${isOverdue ? '#dc2626' : '#64748b'}; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: ${isOverdue ? '700' : '400'};">
                                ${isOverdue ? '⚠️ ' : ''}${dueDateFormatted}
                            </td>
                        </tr>`;
        }).join('')}
                </table>
            </div>`;

        await waitForRateLimit();
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject: `📋 [Nhắc nhở hàng ngày] Bạn có ${totalTasks} công việc cá nhân chưa hoàn thành`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nhắc nhở công việc cá nhân</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f2f5; -webkit-font-smoothing: antialiased;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f2f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="620" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08);">
                    
                    <!-- Header with gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%); padding: 40px 45px; text-align: center;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <img src="${LOGO_URL}" alt="JTSC Logo" style="height: 55px; margin-bottom: 18px; filter: brightness(10);">
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                            📝 BÁO CÁO CÔNG VIỆC CÁ NHÂN
                                        </h1>
                                        <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 10px 0 0; font-weight: 400;">
                                            ${dateStr}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 35px 45px 20px;">
                            <p style="color: #1e293b; font-size: 16px; line-height: 1.7; margin: 0 0 8px;">
                                Xin chào <strong>${userName}</strong>,
                            </p>
                            
                            <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 30px;">
                                Dưới đây là tổng hợp các công việc cá nhân chưa hoàn thành của bạn. Hãy ưu tiên xử lý các công việc quá hạn trước nhé!
                            </p>
                            
                            ${taskListHtml}
                            
                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 30px 0 10px;">
                                <a href="${FRONTEND_URL}/my-tasks" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35); transition: all 0.2s;">
                                    XEM CÔNG VIỆC CỦA TÔI →
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0f172a; padding: 30px 40px; text-align: center;">
                            <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0 0 6px;">
                                Thông báo này được gửi tự động mỗi ngày.
                            </p>
                            <p style="color: #475569; font-size: 11px; margin: 0;">
                                © ${new Date().getFullYear()} JTSC Project Management. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `
        });

        if (error) {
            console.error('[EmailService] Failed to send personal task reminder email:', error);
            return false;
        }

        console.log(`[EmailService] Personal task reminder email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Error sending personal task reminder email:', error);
        return false;
    }
};

export default {
    sendProjectAssignmentEmail,
    sendDeadlineReminderEmail,
    sendTaskReminderEmail,
    sendTaskDeadlineEmail,
    sendKanbanDailyReminderEmail,
    sendPersonalTasksDailyReminderEmail,
    sendTestEmail
};
