import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS?.replace(/\s+/g, ''), // Remove spaces from App Password
    },
});

export async function sendNotificationEmail(
    to: string,
    subject: string,
    html: string
) {
    if (!process.env.SMTP_USER) {
        console.log(`[Mock Email] To: ${to}, Subject: ${subject}`);
        console.log(`[Mock Email Body]: ${html}`);
        return true;
    }

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Legal Tracker" <noreply@company.com>',
            to,
            subject,
            html,
        });
        return true;
    } catch (error) {
        console.error('Email send failed:', error);
        return false;
    }
}
