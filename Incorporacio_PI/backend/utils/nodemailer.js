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
    from: `"Incorporación PI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Tu código de verificación',
    html: `<h1>Tu código es: ${code}</h1>`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Correo enviado a:', email);
    return true;
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    // Debug para ver si lee las variables (sin mostrar la password entera)
    console.log("DEBUG:", { 
      user: process.env.EMAIL_USER, 
      passLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0 
    });
    return false;
  }
}

module.exports = { sendVerificationCode };