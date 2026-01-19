import axios from 'axios';

// 1. DEFINIMOS LA URL BASE CORRECTAMENTE
// Recuperamos la variable de entorno o usamos localhost por defecto
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 2. CONSTRUIMOS LA RUTA DE LA API
// Esto resultará en 'http://tudominio.cat/api' o 'http://localhost:3001/api'
const API_URL = `${BASE_URL}/api`;

export const sendVerificationCode = async (email, recaptchaToken) => {
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