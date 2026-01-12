const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    // Usamos process.env.NOMBRE_DE_LA_VARIABLE
    user: process.env.GOOGLE_USER, 
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN
  }
});

// ... el resto de la función sendVerificationCode igual ...

// Función para enviar correo
async function sendVerificationCode(email, code) {
  const mailOptions = {
    from: 'Tu Aplicación <dammongog4@gmail.com>',
    to: email,
    subject: 'Tu código de verificación',
    text: `Tu código es: ${code}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Verificación de Login</h2>
        <p>Hola,</p>
        <p>Tu código de seguridad es:</p>
        <h1 style="color: #4CAF50; letter-spacing: 5px;">${code}</h1>
        <p>Este código expirará en 10 minutos.</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Correo enviado con éxito a:', email);
    return true;
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    return false;
  }
}

// EXPORTAMOS LA FUNCIÓN
module.exports = { sendVerificationCode };