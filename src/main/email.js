import nodemailer from 'nodemailer'
import { getEmailSettings, upsertEmailContact } from './db'

export async function testEmailConnection(settings) {
  try {
    const transporter = nodemailer.createTransport({
      pool: true,
      host: settings.smtp_host,
      port: Number(settings.smtp_port) || 465,
      secure: Number(settings.smtp_port) === 465, // true for 465, false for other ports
      auth: {
        user: settings.user_email,
        pass: settings.app_password
      }
    })

    await transporter.verify()
    return { ok: true }
  } catch (err) {
    console.error('SMTP Test Error:', err)
    return { ok: false, error: err.message }
  }
}

export async function sendEmail({ to, subject, body, attachments }) {
  try {
    const settings = getEmailSettings()
    if (!settings || !settings.smtp_host || !settings.app_password) {
      throw new Error('Email settings are not fully configured.')
    }

    const transporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      host: settings.smtp_host,
      port: Number(settings.smtp_port) || 465,
      secure: Number(settings.smtp_port) === 465,
      auth: {
        user: settings.user_email,
        pass: settings.app_password
      }
    })

    const mailOptions = {
      from: `"${settings.sender_name}" <${settings.user_email}>`,
      to, // Can be comma separated
      subject,
      html: body, // Support rich text body
      attachments: attachments.map(filepath => ({
        path: filepath
      }))
    }

    const info = await transporter.sendMail(mailOptions)
    
    // Automatically memorialize successful outbound recipients
    try {
      const recipients = to.split(',').map(e => e.trim()).filter(Boolean)
      for (const recipient of recipients) {
        upsertEmailContact(recipient, '')
      }
    } catch (e) {
      console.warn('Failed to upsert contact memory:', e)
    }

    return { ok: true, messageId: info.messageId }
  } catch (err) {
    console.error('SMTP Send Error:', err)
    return { ok: false, error: err.message }
  }
}
