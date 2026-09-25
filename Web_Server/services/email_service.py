"""
Email Service for RoadSense
Handles all outgoing emails: verification, LGU decisions, password reset.
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import settings

logger = logging.getLogger(__name__)


# ============================================================================
# VERIFICATION CODE EMAIL
# ============================================================================

def send_verification_code_email(email: str, code: str):
    """Send a 6-digit verification code to the given email."""
    if not settings.GMAIL_ADDRESS or not settings.GMAIL_APP_PASSWORD:
        raise RuntimeError("Email service not configured.")

    msg = MIMEText(
        f"Your RoadSense verification code is: {code}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you did not request this, ignore this email.\n\n"
        f"— RoadSense by Nova"
    )
    msg["Subject"] = "RoadSense Email Verification"
    msg["From"]    = settings.GMAIL_ADDRESS
    msg["To"]      = email

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(settings.GMAIL_ADDRESS, settings.GMAIL_APP_PASSWORD)
        server.sendmail(settings.GMAIL_ADDRESS, email, msg.as_string())

    logger.info(f"Verification code sent to {email}")


# ============================================================================
# PASSWORD RESET EMAIL
# ============================================================================

def send_password_reset_email(email: str, reset_url: str):
    """Send a password-reset link to the given email."""
    subject    = "RoadSense — Password Reset Request"
    plain_body = (
        f"You requested a password reset for your RoadSense account.\n\n"
        f"Click the link below to reset your password (expires in 30 minutes):\n"
        f"{reset_url}\n\n"
        f"If you didn't request this, ignore this email.\n\n"
        f"— RoadSense by Nova"
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:28px;">
        <h1 style="color:#2dd4bf;font-size:22px;margin:0;">RoadSense</h1>
        <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Smart monitoring for safer roads</p>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <span style="background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.3);padding:6px 18px;border-radius:999px;font-size:13px;font-weight:600;">Password Reset Request</span>
      </div>
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">
        You requested a password reset for your RoadSense account associated with
        <strong style="color:#f1f5f9;">{email}</strong>.
      </p>
      <p style="color:#94a3b8;font-size:13px;margin-bottom:24px;">
        This link expires in <strong style="color:#f1f5f9;">30 minutes</strong>.
        If you didn't request this, you can safely ignore this email.
      </p>
      <div style="text-align:center;margin-bottom:28px;">
        <a href="{reset_url}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#06b6d4);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;">Reset My Password →</a>
      </div>
      <p style="color:#475569;font-size:12px;text-align:center;margin-bottom:24px;">
        Button not working? <a href="{reset_url}" style="color:#2dd4bf;word-break:break-all;">{reset_url}</a>
      </p>
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;"/>
      <p style="color:#334155;font-size:11px;text-align:center;margin:0;">© 2026 Nova Technology.</p>
    </div>"""

    _send_html_email(email, subject, plain_body, html_body)
    logger.info(f"Password reset email sent to {email}")


# ============================================================================
# LGU EMAILS
# ============================================================================

def send_lgu_pending_email(email: str, city: str, barangay: str):
    """Confirmation email when an LGU request is submitted and awaiting review."""
    if not settings.GMAIL_ADDRESS or not settings.GMAIL_APP_PASSWORD:
        logger.warning("Email service not configured — skipping pending email.")
        return

    subject    = "RoadSense — LGU Registration Received ⏳"
    plain_body = (
        f"Your LGU registration for Brgy. {barangay}, {city} has been received.\n\n"
        f"Status: Pending administrator review\n\n"
        f"What happens next:\n"
        f"- An administrator will review your LGU details\n"
        f"- You'll receive an email once a decision is made\n"
        f"- If approved, you can complete your account setup via the link in that email\n"
        f"- This typically takes 1–2 business days\n\n"
        f"— RoadSense by Nova"
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:28px;">
        <h1 style="color:#2dd4bf;font-size:22px;margin:0;">RoadSense</h1>
        <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Smart monitoring for safer roads</p>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <span style="background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);padding:6px 18px;border-radius:999px;font-size:13px;font-weight:600;">⏳ Awaiting Admin Approval</span>
      </div>
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">
        Your LGU registration request for <strong style="color:#f1f5f9;">Brgy. {barangay}, {city}</strong>
        has been <strong style="color:#fbbf24;">received</strong> and is now awaiting administrator review.
      </p>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#64748b;font-size:11px;text-transform:uppercase;padding:6px 0;">Registered Email</td>
            <td style="color:#f1f5f9;font-size:13px;text-align:right;padding:6px 0;">{email}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:11px;text-transform:uppercase;padding:6px 0;">Jurisdiction</td>
            <td style="color:#f1f5f9;font-size:13px;text-align:right;padding:6px 0;">Brgy. {barangay}, {city}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:11px;text-transform:uppercase;padding:6px 0;">Status</td>
            <td style="color:#fbbf24;font-size:13px;font-weight:600;text-align:right;padding:6px 0;">Pending Review ⏳</td>
          </tr>
        </table>
      </div>
      <div style="background:#1e293b;border-left:3px solid #2dd4bf;border-radius:4px;padding:16px;margin-bottom:24px;">
        <p style="color:#e2e8f0;font-size:13px;margin:0 0 8px 0;font-weight:600;">What happens next?</p>
        <ul style="color:#94a3b8;font-size:13px;margin:0;padding-left:18px;line-height:1.8;">
          <li>A system administrator will review your LGU details</li>
          <li>You will receive an email once a decision is made</li>
          <li>If approved, you can complete your account setup via the link in that email</li>
          <li>This typically takes <strong style="color:#e2e8f0;">1–2 business days</strong></li>
        </ul>
      </div>
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;"/>
      <p style="color:#334155;font-size:11px;text-align:center;margin:0;">
        © 2026 Nova Technology. This email was sent to {email} regarding your RoadSense LGU registration.
      </p>
    </div>"""

    _send_html_email(email, subject, plain_body, html_body)
    logger.info(f"Pending notification email sent to {email}")


def send_lgu_decision_email(email: str, city: str, barangay: str, action: str):
    """Send approve / reject / revoke / reopen decision email to LGU."""
    if not settings.GMAIL_ADDRESS or not settings.GMAIL_APP_PASSWORD:
        logger.warning("Email service not configured — skipping decision email.")
        return

    resume_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/login?resume=1"

    if action == "approve":
        subject    = "RoadSense — Your LGU Account Has Been Approved ✓"
        plain_body = (
            f"Your LGU registration for Brgy. {barangay}, {city} has been approved.\n\n"
            f"Complete your account setup here:\n{resume_url}\n\n"
            f"— RoadSense by Nova"
        )
        html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:28px;">
            <h1 style="color:#2dd4bf;font-size:22px;margin:0;">RoadSense</h1>
            <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Smart monitoring for safer roads</p>
          </div>
          <div style="text-align:center;margin-bottom:24px;">
            <span style="background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.3);padding:6px 18px;border-radius:999px;font-size:13px;font-weight:600;">✓ LGU Request Approved</span>
          </div>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">
            Great news! Your LGU registration for <strong style="color:#f1f5f9;">Brgy. {barangay}, {city}</strong>
            has been <strong style="color:#2dd4bf;">approved</strong> by the system administrator.
          </p>
          <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#64748b;font-size:11px;text-transform:uppercase;padding:4px 0;">Email</td><td style="color:#f1f5f9;font-size:13px;text-align:right;padding:4px 0;">{email}</td></tr>
              <tr><td style="color:#64748b;font-size:11px;text-transform:uppercase;padding:4px 0;">Jurisdiction</td><td style="color:#f1f5f9;font-size:13px;text-align:right;padding:4px 0;">Brgy. {barangay}, {city}</td></tr>
              <tr><td style="color:#64748b;font-size:11px;text-transform:uppercase;padding:4px 0;">Status</td><td style="color:#2dd4bf;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">Approved ✓</td></tr>
            </table>
          </div>
          <div style="text-align:center;margin-bottom:28px;">
            <a href="{resume_url}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#06b6d4);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;">Complete Account Setup →</a>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;margin-bottom:24px;">
            Button not working? <a href="{resume_url}" style="color:#2dd4bf;word-break:break-all;">{resume_url}</a>
          </p>
          <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;"/>
          <p style="color:#334155;font-size:11px;text-align:center;margin:0;">© 2026 Nova Technology.</p>
        </div>"""

    elif action == "reject":
        subject    = "RoadSense — LGU Registration Update"
        plain_body = (
            f"Your LGU registration for Brgy. {barangay}, {city} was not approved.\n\n"
            f"Contact your system administrator if you believe this is an error.\n\n"
            f"— RoadSense by Nova"
        )
        html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:28px;">
            <h1 style="color:#2dd4bf;font-size:22px;margin:0;">RoadSense</h1>
            <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Smart monitoring for safer roads</p>
          </div>
          <div style="text-align:center;margin-bottom:24px;">
            <span style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);padding:6px 18px;border-radius:999px;font-size:13px;font-weight:600;">Registration Not Approved</span>
          </div>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">
            Your LGU registration for <strong style="color:#f1f5f9;">Brgy. {barangay}, {city}</strong> has not been approved at this time.
          </p>
          <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="color:#94a3b8;font-size:13px;margin:0;line-height:1.6;">
              Contact your system administrator with your registered email (<strong style="color:#e2e8f0;">{email}</strong>) if you believe this is an error.
            </p>
          </div>
          <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;"/>
          <p style="color:#334155;font-size:11px;text-align:center;margin:0;">© 2026 Nova Technology.</p>
        </div>"""

    elif action == "revoke":
        subject    = "RoadSense — LGU Account Access Revoked"
        plain_body = (
            f"Your LGU account access for Brgy. {barangay}, {city} has been temporarily revoked.\n\n"
            f"To re-apply, visit: {resume_url}\n\n"
            f"— RoadSense by Nova"
        )
        html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:28px;">
            <h1 style="color:#2dd4bf;font-size:22px;margin:0;">RoadSense</h1>
            <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Smart monitoring for safer roads</p>
          </div>
          <div style="text-align:center;margin-bottom:24px;">
            <span style="background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);padding:6px 18px;border-radius:999px;font-size:13px;font-weight:600;">⚠ Account Access Revoked</span>
          </div>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">
            Your LGU access for <strong style="color:#f1f5f9;">Brgy. {barangay}, {city}</strong> has been temporarily revoked by the administrator.
          </p>
          <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="color:#94a3b8;font-size:13px;margin:0;line-height:1.6;">
              If this was a mistake, contact your administrator. To re-apply for access, visit the link below.
            </p>
          </div>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="{resume_url}" style="display:inline-block;background:linear-gradient(135deg,#b45309,#d97706);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;">Re-apply for Access →</a>
          </div>
          <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;"/>
          <p style="color:#334155;font-size:11px;text-align:center;margin:0;">© 2026 Nova Technology.</p>
        </div>"""

    elif action == "reopen":
        subject    = "RoadSense — LGU Registration Re-opened"
        plain_body = (
            f"Your LGU registration for Brgy. {barangay}, {city} has been re-opened for review.\n\n"
            f"You will be notified by email once a decision is made.\n\n"
            f"— RoadSense by Nova"
        )
        html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:28px;">
            <h1 style="color:#2dd4bf;font-size:22px;margin:0;">RoadSense</h1>
            <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Smart monitoring for safer roads</p>
          </div>
          <div style="text-align:center;margin-bottom:24px;">
            <span style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);padding:6px 18px;border-radius:999px;font-size:13px;font-weight:600;">↺ Registration Re-opened</span>
          </div>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">
            Your LGU registration for <strong style="color:#f1f5f9;">Brgy. {barangay}, {city}</strong> has been re-opened for review.
            You will be notified once a decision is made.
          </p>
          <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;"/>
          <p style="color:#334155;font-size:11px;text-align:center;margin:0;">© 2026 Nova Technology.</p>
        </div>"""

    else:
        logger.warning(f"Unknown action '{action}' — no email sent.")
        return

    _send_html_email(email, subject, plain_body, html_body)
    logger.info(f"Decision email ({action}) sent to {email}")


# ============================================================================
# INTERNAL HELPER
# ============================================================================

def _send_html_email(to: str, subject: str, plain: str, html: str):
    """Low-level helper — sends a plain+HTML multipart email via Gmail SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.GMAIL_ADDRESS
    msg["To"]      = to
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html,  "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(settings.GMAIL_ADDRESS, settings.GMAIL_APP_PASSWORD)
        server.sendmail(settings.GMAIL_ADDRESS, to, msg.as_string())
        
def send_account_deletion_email(email: str, full_name: str, city: str, barangay: str, admin_name: str): 
    """Notify LGU that their account deletion has been requested by admin."""
    if not settings.GMAIL_ADDRESS or not settings.GMAIL_APP_PASSWORD:
        logger.warning("Email service not configured — skipping deletion email.")
        return

    subject    = "RoadSense — Account Deletion Notice"
    plain_body = (
        f"Dear {full_name},\n\n"
        f"Your RoadSense LGU account for Brgy. {barangay}, {city} has been scheduled for deletion "
        f"by administrator '{admin_name}'.\n\n"
        f"If you believe this is a mistake, please contact your system administrator immediately.\n\n"
        f"— RoadSense by Nova"
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:28px;">
        <h1 style="color:#2dd4bf;font-size:22px;margin:0;">RoadSense</h1>
        <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Smart monitoring for safer roads</p>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <span style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);
                     padding:6px 18px;border-radius:999px;font-size:13px;font-weight:600;">
          ⚠ Account Deletion Notice
        </span>
      </div>
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">
        Dear <strong style="color:#f1f5f9;">{full_name}</strong>,
      </p>
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">
        Your RoadSense LGU account for <strong style="color:#f1f5f9;">Brgy. {barangay}, {city}</strong>
        has been scheduled for deletion by administrator <strong style="color:#f1f5f9;">{admin_name}</strong>.
      </p>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#64748b;font-size:11px;text-transform:uppercase;padding:4px 0;">Account</td>
            <td style="color:#f1f5f9;font-size:13px;text-align:right;padding:4px 0;">{email}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:11px;text-transform:uppercase;padding:4px 0;">Jurisdiction</td>
            <td style="color:#f1f5f9;font-size:13px;text-align:right;padding:4px 0;">Brgy. {barangay}, {city}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:11px;text-transform:uppercase;padding:4px 0;">Actioned By</td>
            <td style="color:#f87171;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">{admin_name}</td>
          </tr>
        </table>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:24px;">
        If you believe this is a mistake, please contact your system administrator immediately before
        your account is permanently removed.
      </p>
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;"/>
      <p style="color:#334155;font-size:11px;text-align:center;margin:0;">© 2026 Nova Technology.</p>
    </div>"""

    _send_html_email(email, subject, plain_body, html_body)
    logger.info(f"Account deletion email sent to {email}")