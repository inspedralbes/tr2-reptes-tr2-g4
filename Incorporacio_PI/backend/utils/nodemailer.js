const nodemailer = require("nodemailer");

// --- CONFIGURACIÓN ROBUSTA PARA SERVIDORES / FIREWALLS ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,               // Usamos el puerto estándar de TLS
  secure: false,           // 'false' para el puerto 587 (true es para el 465)
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  },
  // ESTO ES LA CLAVE PARA QUE FUNCIONE EN EL INSTITUTO:
  tls: {
    rejectUnauthorized: false, // Ignora errores de certificado (común en redes corporativas)
    ciphers: 'SSLv3'           // Usa cifrados compatibles
  },
  connectionTimeout: 10000, // Si falla, que falle en 10 segundos, no en 2 minutos
  greetingTimeout: 10000
});

// Verificamos la conexión al arrancar (para ver errores en el log rápido)
transporter.verify(function (error, success) {
  if (error) {
    console.log("⚠️ ERROR CONFIGURACIÓN SMTP:", error.message);
  } else {
    console.log("✅ Servidor SMTP llest per enviar correus.");
  }
});

async function sendVerificationCode(email, code) {
  const mailOptions = {
    // Remitente con nombre oficial
    from: `"Plataforma PI - Generalitat de Catalunya" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Codi de verificació d\'accés a la Plataforma PI',
    text: `Codi de verificació: ${code}. Aquest codi caducarà en 10 minuts. Si no l'heu sol·licitat, ignoreu aquest missatge.`,
    html: `
      <!DOCTYPE html>
      <html lang="ca">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e0e0e0; }
          .header { background-color: #ffffff; padding: 20px 30px; border-top: 4px solid #D0021B; border-bottom: 1px solid #eeeeee; }
          .header-title { color: #333333; font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .header-subtitle { color: #666666; font-size: 14px; margin-top: 5px; }
          .content { padding: 30px; color: #333333; line-height: 1.6; }
          .code-box { background-color: #f8f9fa; border: 1px solid #dee2e6; border-left: 4px solid #333; padding: 20px; text-align: center; margin: 25px 0; }
          .code { font-size: 32px; font-weight: bold; color: #D0021B; letter-spacing: 4px; font-family: 'Courier New', monospace; }
          .warning { font-size: 13px; color: #666; background-color: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 20px; }
          .footer { background-color: #333333; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
          .footer a { color: #ffffff; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="header-title">Generalitat de Catalunya</h1>
            <div class="header-subtitle">Departament d'Educació i Formació Professional</div>
          </div>

          <div class="content">
            <p style="margin-top: 0;">Benvolgut/da,</p>
            
            <p>Us informem que s'ha iniciat un procés d'autenticació per accedir a la <strong>Plataforma de Gestió de Plans Individualitzats (PI)</strong>.</p>
            
            <p>Per completar l'accés, introduïu el següent codi de verificació d'un sol ús:</p>

            <div class="code-box">
              <span class="code">${code}</span>
            </div>

            <p style="font-size: 14px;">Aquest codi té una validesa de <strong>10 minuts</strong>.</p>

            <div class="warning">
              <strong>Avís de seguretat:</strong> Si no heu sol·licitat aquest accés, si us plau, no compartiu aquest codi i contacteu immediatament amb el suport tècnic o ignoreu aquest missatge.
            </div>
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Generalitat de Catalunya. Tots els drets reservats.<br>
            Aquest missatge s'ha enviat automàticament, si us plau no hi respongueu.
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    console.log(`📨 Intentant enviar correu a ${email} via SMTP...`);
    await transporter.sendMail(mailOptions);
    console.log('✅ Correu enviat correctament a:', email);
    return true;
  } catch (error) {
    console.error('❌ Error enviant el correu:', error.message);
    if (error.response) console.error("   Response:", error.response);
    return false;
  }
}

module.exports = { sendVerificationCode };