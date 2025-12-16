import { Resend } from 'resend';

// Resend configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_8grmWuyt_BQr7tyewgEzwgr7qzrQLMd55';
const FROM_EMAIL = process.env.FROM_EMAIL || 'JTSC Project <noreply@jtscpro.top>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://jtsc.io.vn';
const LOGO_URL = `${FRONTEND_URL}/Logo.png`;

// Initialize Resend
const resend = new Resend(RESEND_API_KEY);

console.log('[EmailService] Initialized with domain: jtscpro.top');

// ==================== EMAIL TEMPLATES ====================

// Project Assignment Email Template
const getProjectAssignmentEmailHtml = (
    userName: string,
    projectName: string,
    projectCode: string,
    role: 'manager' | 'implementer' | 'follower',
    assignerName: string,
    startDate: string | null,
    endDate: string | null,
    description: string | null,
    projectUrl: string
): string => {
    const roleText = {
        manager: 'Quản lý dự án',
        implementer: 'Người thực hiện',
        follower: 'Người theo dõi'
    };

    const roleColor = {
        manager: '#e74c3c',
        implementer: '#3498db',
        follower: '#27ae60'
    };

    const roleDescription = {
        manager: 'Với vai trò Quản lý dự án, bạn sẽ chịu trách nhiệm giám sát tiến độ, phân công công việc và đảm bảo dự án hoàn thành đúng hạn.',
        implementer: 'Với vai trò Người thực hiện, bạn sẽ trực tiếp tham gia triển khai các công việc được giao trong dự án này.',
        follower: 'Với vai trò Người theo dõi, bạn sẽ được cập nhật thông tin và có thể theo dõi tiến độ của dự án.'
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
    role: 'manager' | 'implementer' | 'follower',
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
            follower: 'Theo dõi'
        };

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

export default {
    sendProjectAssignmentEmail,
    sendDeadlineReminderEmail,
    sendTestEmail
};
