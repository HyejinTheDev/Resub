const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

let transporter = null;

if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    connectionTimeout: 3000, // 3 seconds
    greetingTimeout: 3000,
    socketTimeout: 5000,
  });
} else {
  console.warn('⚠️ WARNING: EMAIL_USER and EMAIL_PASS are not configured in .env. Email OTP service is inactive.');
}

function getEmailHtmlTemplate(otpCode) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mã xác minh tài khoản RESUB</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #0c0d14;
          color: #e2e8f0;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: radial-gradient(circle at center, #1e202c 0%, #0c0d14 100%);
          border: 1px solid #2d3748;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .header {
          padding: 32px;
          text-align: center;
          border-bottom: 1px solid #1a202c;
        }
        .logo {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: 2px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }
        .content {
          padding: 40px 32px;
          line-height: 1.6;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #ffffff;
        }
        .message {
          font-size: 14px;
          color: #a0aec0;
          margin-bottom: 32px;
        }
        .otp-box {
          background-color: rgba(16, 185, 129, 0.1);
          border: 2px dashed #10b981;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          margin-bottom: 32px;
        }
        .otp-code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 36px;
          font-weight: 800;
          letter-spacing: 8px;
          color: #10b981;
          margin: 0;
        }
        .expiry {
          font-size: 12px;
          color: #e53e3e;
          margin-top: 8px;
          font-weight: 600;
        }
        .footer {
          padding: 32px;
          text-align: center;
          border-top: 1px solid #1a202c;
          background-color: rgba(0, 0, 0, 0.2);
        }
        .footer-text {
          font-size: 11px;
          color: #718096;
          margin: 0;
        }
        .footer-link {
          color: #10b981;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo">RESUB</h1>
          <div style="font-size: 11px; color: #718096; margin-top: 4px; letter-spacing: 1px;">AUTO DUBBING PLATFORM</div>
        </div>
        <div class="content">
          <div class="greeting">Chào mừng bạn đến với RESUB!</div>
          <div class="message">
            Chúng tôi nhận được yêu cầu đăng ký tài khoản của bạn. Vui lòng nhập mã xác minh bên dưới để hoàn tất xác thực thông tin và kích hoạt tài khoản của bạn:
          </div>
          
          <div class="otp-box">
            <div class="otp-code">${otpCode}</div>
            <div class="expiry">Mã này có hiệu lực trong vòng 5 phút</div>
          </div>
          
          <div class="message" style="margin-bottom: 0;">
            Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ bộ phận bảo mật của chúng tôi.
          </div>
        </div>
        <div class="footer">
          <p class="footer-text">
            Thư này được gửi tự động từ hệ thống lồng tiếng video <a href="#" class="footer-link">RESUB App</a>.
          </p>
          <p class="footer-text" style="margin-top: 8px;">
            © ${new Date().getFullYear()} RESUB Inc. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send OTP verification email to user
 * @param {string} toEmail 
 * @param {string} otpCode 
 * @returns {Promise<boolean>}
 */
async function sendOtpEmail(toEmail, otpCode) {
  const htmlContent = getEmailHtmlTemplate(otpCode);

  // 1. Try sending via Resend API if configured
  if (RESEND_API_KEY) {
    console.log(`[Email Service] Sending OTP email to ${toEmail} using Resend HTTP API...`);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'RESUB Support <onboarding@resend.dev>',
          to: toEmail,
          subject: `[RESUB] Mã xác minh đăng ký tài khoản: ${otpCode}`,
          html: htmlContent
        })
      });

      const result = await response.json();
      if (response.ok && result.id) {
        console.log(`[Email Service] Verification email sent to ${toEmail} via Resend: ${result.id}`);
        return true;
      } else {
        console.error('[Email Service] Resend API error:', JSON.stringify(result));
      }
    } catch (error) {
      console.error('[Email Service] Resend HTTP request failed:', error.message);
    }
  }

  // 2. Fallback to Nodemailer SMTP
  if (!transporter) {
    console.warn(`[Email Service] Cannot send email to ${toEmail} because SMTP transporter is not configured.`);
    return false;
  }

  const mailOptions = {
    from: `"RESUB Support" <${EMAIL_USER}>`,
    to: toEmail,
    subject: `[RESUB] Mã xác minh đăng ký tài khoản: ${otpCode}`,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Verification email sent to ${toEmail} via SMTP: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email Service] Failed to send email to ${toEmail} via SMTP:`, error.message);
    return false;
  }
}

module.exports = {
  sendOtpEmail,
};
