import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const createTransporter = () => {
  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');

  if (!emailUser || !emailPass) {
    console.warn('⚠️ Credenciais de email não configuradas no .env (EMAIL_USER e EMAIL_PASS). E-mails não serão enviados.');
    return null;
  }

  return nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

export class MailService {
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    const transporter = createTransporter();

    if (!transporter) {
      console.error('Email transporter not configured');
      return false;
    }

    try {
      const info = await transporter.sendMail({
        from: `"Oki Health" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log('✅ Email enviado com sucesso:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      return false;
    }
  }

  static async sendPasswordResetEmail(
    email: string,
    code: string,
    userName: string
  ): Promise<boolean> {
    const subject = 'Recuperação de Senha - Oki Health';
    
    const text = `
  Olá ${userName},
  
  Você solicitou a recuperação de senha da sua conta no Oki Health.
  
  Seu código de verificação é: ${code}
  
  Este código expira em 15 minutos.
  
  Se você não solicitou esta recuperação, ignore este email.
  
  Atenciosamente,
  Equipe Oki Health
    `.trim();
  
    const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .container {
        background-color: #f9f9f9;
        border-radius: 10px;
        padding: 30px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .header {
        background-color: #4CAF50;
        color: white;
        padding: 20px;
        border-radius: 10px 10px 0 0;
        text-align: center;
        margin: -30px -30px 30px -30px;
      }
      .code-box {
        background-color: #fff;
        border: 2px dashed #4CAF50;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        margin: 20px 0;
      }
      .code {
        font-size: 32px;
        font-weight: bold;
        color: #4CAF50;
        letter-spacing: 5px;
        font-family: 'Courier New', monospace;
      }
      .warning {
        background-color: #fff3cd;
        border-left: 4px solid #ffc107;
        padding: 12px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .footer {
        text-align: center;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        color: #666;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="margin: 0;">Oki Health</h1>
        <p style="margin: 5px 0 0 0;">Recuperação de Senha</p>
      </div>
      
      <p>Olá <strong>${userName}</strong>,</p>
      
      <p>Você solicitou a recuperação de senha da sua conta no Oki Health.</p>
      
      <p>Use o código abaixo no aplicativo para redefinir sua senha:</p>
      
      <div class="code-box">
        <div class="code">${code}</div>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">Código de Verificação</p>
      </div>
      
      <div class="warning">
        <strong>⏰ Atenção:</strong> Este código expira em <strong>15 minutos</strong>.
      </div>
      
      <p style="color: #666; font-size: 14px;">
        Se você não solicitou esta recuperação, ignore este email. Sua senha permanecerá inalterada.
      </p>
      
      <div class="footer">
        <p>Atenciosamente,<br><strong>Equipe Oki Health</strong></p>
      </div>
    </div>
  </body>
  </html>
    `.trim();
  
    return this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });
  }
}
