/**
 * Email Service using Resend
 * 
 * Handles transactional emails for LitLens:
 * - Project invitations
 * - Password reset
 * - Screening notifications
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "LitLens <noreply@litlens.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ============== TYPES ==============

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
}

export interface InvitationEmailData {
    recipientEmail: string;
    recipientName?: string;
    inviterName: string;
    projectTitle: string;
    role: string;
    inviteToken: string;
}

export interface PasswordResetData {
    email: string;
    resetToken: string;
    userName?: string;
}

export interface ScreeningAssignmentData {
    email: string;
    userName: string;
    projectTitle: string;
    studyCount: number;
    projectUrl: string;
}

// ============== CORE SEND FUNCTION ==============

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: Array.isArray(options.to) ? options.to : [options.to],
            subject: options.subject,
            html: options.html,
            text: options.text,
            reply_to: options.replyTo,
        });

        if (error) {
            console.error("Email send error:", error);
            return { success: false, error: error.message };
        }

        return { success: true, id: data?.id };
    } catch (error) {
        console.error("Email service error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

// ============== EMAIL TEMPLATES ==============

export async function sendProjectInvitation(data: InvitationEmailData): Promise<{ success: boolean; error?: string }> {
    const inviteUrl = `${APP_URL}/invitations/${data.inviteToken}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Invitation</title>
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; background-color: #f5f5f0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border: 1px solid #dcdcc6; box-shadow: 0 4px 30px rgba(26, 51, 32, 0.08);">
    <!-- Header -->
    <div style="padding: 40px 40px 20px; border-bottom: 1px solid #dcdcc6;">
      <h1 style="margin: 0; font-size: 32px; color: #1a3320; font-weight: normal; font-style: italic;">LitLens</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px;">
      <p style="color: #6b705c; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 20px;">
        Project Invitation
      </p>
      
      <h2 style="margin: 0 0 20px; font-size: 28px; color: #1a3320; font-weight: normal;">
        ${data.recipientName ? `Hello ${data.recipientName},` : 'Hello,'}
      </h2>
      
      <p style="margin: 0 0 20px; font-size: 18px; color: #1a3320; line-height: 1.6;">
        <strong>${data.inviterName}</strong> has invited you to collaborate on a systematic review project:
      </p>
      
      <div style="background: #f5f5f0; padding: 24px; margin: 24px 0; border-left: 3px solid #c2b280;">
        <h3 style="margin: 0 0 8px; font-size: 22px; color: #1a3320; font-weight: normal; font-style: italic;">
          ${data.projectTitle}
        </h3>
        <p style="margin: 0; font-size: 14px; color: #6b705c;">
          Your role: <strong>${data.role}</strong>
        </p>
      </div>
      
      <a href="${inviteUrl}" 
         style="display: inline-block; padding: 16px 32px; background: #1a3320; color: #f5f5f0; text-decoration: none; font-style: italic; font-size: 16px; margin-top: 16px;">
        Accept Invitation →
      </a>
      
      <p style="margin: 32px 0 0; font-size: 14px; color: #6b705c; line-height: 1.6;">
        This invitation will expire in 7 days. If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="padding: 24px 40px; background: #1a3320; color: #f5f5f0;">
      <p style="margin: 0; font-size: 12px; opacity: 0.7;">
        Sent by LitLens — Research Intelligence Platform
      </p>
    </div>
  </div>
</body>
</html>
  `;

    const text = `
You've been invited to collaborate on LitLens!

${data.inviterName} has invited you to join the project "${data.projectTitle}" as a ${data.role}.

Accept the invitation: ${inviteUrl}

This invitation expires in 7 days.
  `;

    return sendEmail({
        to: data.recipientEmail,
        subject: `You're invited to collaborate on "${data.projectTitle}"`,
        html,
        text,
    });
}

export async function sendPasswordReset(data: PasswordResetData): Promise<{ success: boolean; error?: string }> {
    const resetUrl = `${APP_URL}/auth/reset-password?token=${data.resetToken}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; background-color: #f5f5f0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border: 1px solid #dcdcc6; box-shadow: 0 4px 30px rgba(26, 51, 32, 0.08);">
    <div style="padding: 40px 40px 20px; border-bottom: 1px solid #dcdcc6;">
      <h1 style="margin: 0; font-size: 32px; color: #1a3320; font-weight: normal; font-style: italic;">LitLens</h1>
    </div>
    
    <div style="padding: 40px;">
      <p style="color: #6b705c; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 20px;">
        Password Reset
      </p>
      
      <h2 style="margin: 0 0 20px; font-size: 28px; color: #1a3320; font-weight: normal;">
        ${data.userName ? `Hello ${data.userName},` : 'Hello,'}
      </h2>
      
      <p style="margin: 0 0 20px; font-size: 18px; color: #1a3320; line-height: 1.6;">
        We received a request to reset your password. Click the button below to create a new password:
      </p>
      
      <a href="${resetUrl}" 
         style="display: inline-block; padding: 16px 32px; background: #1a3320; color: #f5f5f0; text-decoration: none; font-style: italic; font-size: 16px; margin-top: 16px;">
        Reset Password →
      </a>
      
      <p style="margin: 32px 0 0; font-size: 14px; color: #6b705c; line-height: 1.6;">
        This link expires in 1 hour. If you didn't request this, please ignore this email—your password will remain unchanged.
      </p>
    </div>
    
    <div style="padding: 24px 40px; background: #1a3320; color: #f5f5f0;">
      <p style="margin: 0; font-size: 12px; opacity: 0.7;">
        Sent by LitLens — Research Intelligence Platform
      </p>
    </div>
  </div>
</body>
</html>
  `;

    return sendEmail({
        to: data.email,
        subject: "Reset your LitLens password",
        html,
    });
}

export async function sendScreeningAssignment(data: ScreeningAssignmentData): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Georgia, 'Times New Roman', serif; background-color: #f5f5f0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border: 1px solid #dcdcc6; box-shadow: 0 4px 30px rgba(26, 51, 32, 0.08);">
    <div style="padding: 40px 40px 20px; border-bottom: 1px solid #dcdcc6;">
      <h1 style="margin: 0; font-size: 32px; color: #1a3320; font-weight: normal; font-style: italic;">LitLens</h1>
    </div>
    
    <div style="padding: 40px;">
      <p style="color: #6b705c; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 20px;">
        Screening Assignment
      </p>
      
      <h2 style="margin: 0 0 20px; font-size: 28px; color: #1a3320; font-weight: normal;">
        Hello ${data.userName},
      </h2>
      
      <p style="margin: 0 0 20px; font-size: 18px; color: #1a3320; line-height: 1.6;">
        You have <strong>${data.studyCount} new studies</strong> to screen in the project:
      </p>
      
      <div style="background: #f5f5f0; padding: 24px; margin: 24px 0; border-left: 3px solid #c2b280;">
        <h3 style="margin: 0; font-size: 22px; color: #1a3320; font-weight: normal; font-style: italic;">
          ${data.projectTitle}
        </h3>
      </div>
      
      <a href="${data.projectUrl}" 
         style="display: inline-block; padding: 16px 32px; background: #1a3320; color: #f5f5f0; text-decoration: none; font-style: italic; font-size: 16px; margin-top: 16px;">
        Start Screening →
      </a>
    </div>
    
    <div style="padding: 24px 40px; background: #1a3320; color: #f5f5f0;">
      <p style="margin: 0; font-size: 12px; opacity: 0.7;">
        Sent by LitLens — Research Intelligence Platform
      </p>
    </div>
  </div>
</body>
</html>
  `;

    return sendEmail({
        to: data.email,
        subject: `${data.studyCount} studies ready for screening - ${data.projectTitle}`,
        html,
    });
}
