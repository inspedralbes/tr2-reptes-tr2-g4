import axios from 'axios';

// Mantenim la teva URL original
const API_URL = 'http://localhost:3001/api'; 

export const sendVerificationCode = async (email, recaptchaToken) => {
  // NOU: Ara enviem un objecte amb l'email I el token del Captcha
  // El backend esperarà rebre { email: '...', recaptchaToken: '...' }
  const response = await axios.post(`${API_URL}/login/send-code`, { 
    email: email,
    recaptchaToken: recaptchaToken 
  });
  return response.data;
};

export const verifyCode = async (email, code) => {
  // Aquest es queda igual, només envia email i codi
  const response = await axios.post(`${API_URL}/login/verify-code`, { email, code });
  return response.data;
};