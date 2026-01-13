const nodemailer = require("nodemailer");

// Configuración con Contraseña de Aplicación (Simple y Efectiva)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  }
});

async function sendVerificationCode(email, code) {
  const mailOptions = {
    // He canviat el nom del remitent a "Incorporació PI" (amb accent)
    from: `"Incorporació PI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Codi de verificació per a l\'accés', // Assumpte més professional
    text: `El vostre codi de verificació és: ${code}. Aquest codi caducarà en 10 minuts.`, // Versió text pla
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
        <h2 style="color: #2c3e50; text-align: center;">Verificació de Seguretat</h2>
        <p style="font-size: 16px; color: #333;">Benvolgut/da,</p>
        
        <p style="font-size: 16px; color: #555; line-height: 1.5;">
          Hem rebut una sol·licitud per iniciar sessió al vostre compte de la plataforma <strong>Incorporació PI</strong>.
          Per continuar amb el procés d'accés, utilitzeu el següent codi de verificació:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 5px; background-color: #fff; padding: 10px 20px; border: 1px solid #ccc; border-radius: 5px;">
            ${code}
          </span>
        </div>

        <p style="font-size: 14px; color: #777;">
          ⚠️ Aquest codi és vàlid només durant els pròxims <strong>10 minuts</strong>.
        </p>

        <p style="font-size: 14px; color: #777; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px;">
          Si no heu sol·licitat aquest codi, és possible que algú estigui intentant accedir al vostre compte. Si us plau, ignoreu aquest missatge o contacteu amb l'administrador del sistema.
        </p>
        
        <p style="text-align: center; font-size: 12px; color: #aaa; margin-top: 30px;">
          © 2026 Incorporació PI. Tots els drets reservats.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Correu enviat correctament a:', email);
    return true;
  } catch (error) {
    console.error('❌ Error enviant el correu:', error);
    // Debug per veure si llegeix les variables (sense mostrar la contrasenya sencera)
    console.log("DEBUG:", { 
      user: process.env.EMAIL_USER, 
      passLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0 
    });
    return false;
  }
}

module.exports = { sendVerificationCode };