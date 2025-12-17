export const sendVerificationCode = async (email) => {
  console.log(`Enviando código a ${email}`);

  // Simulación de API
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 1000);
  });
};

export const verifyCode = async (email, code) => {
  console.log(`Verificando código ${code} para ${email}`);

  // Simulación de validación
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (code === '123456') {
        resolve(true);
      } else {
        reject(new Error('Código incorrecto'));
      }
    }, 1000);
  });
};
