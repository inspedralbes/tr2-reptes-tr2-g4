import axios from 'axios';

// 1. CAMBIO CLAVE: Usamos la variable de entorno o localhost por defecto
// Esto leerá lo que pusimos en .env.production (http://incorporacio-pi...)
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

export const sendVerificationCode = async (email, recaptchaToken) => {
  // El backend espera { email, recaptchaToken }
  const response = await axios.post(`${API_URL}/login/send-code`, { 
    email: email,
    recaptchaToken: recaptchaToken 
  });
  return response.data;
};

export const verifyCode = async (email, code) => {
  const response = await axios.post(`${API_URL}/login/verify-code`, { email, code });
  return response.data;
};