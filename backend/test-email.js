// Test script để gửi email trực tiếp qua Resend API
import https from 'https';

const RESEND_API_KEY = 're_8grmWuyt_BQr7tyewgEzwgr7qzrQLMd55';
const TO_EMAIL = 'dinhcongnhat02@gmail.com';
const LOGO_URL = 'https://jtsc.io.vn/Logo.png';
const FRONTEND_URL = 'https://jtsc.io.vn';

const emailData = JSON.stringify({
    from: 'JTSC Project <noreply@jtscpro.top>',
    to: TO_EMAIL,
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

const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailData)
    }
};

console.log('Đang gửi email mới với logo và văn phong chuyên nghiệp...');
console.log('Đến:', TO_EMAIL);
console.log('...');

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', data);

        if (res.statusCode === 200) {
            console.log('\n✅ Email đã gửi thành công!');
            console.log('Kiểm tra hộp thư:', TO_EMAIL);
        } else {
            console.log('\n❌ Gửi email thất bại!');
        }
    });
});

req.on('error', (error) => {
    console.error('Lỗi:', error.message);
});

req.write(emailData);
req.end();
