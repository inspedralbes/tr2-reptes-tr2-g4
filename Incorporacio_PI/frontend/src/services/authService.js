import axios from 'axios';

// 1. CORREGIDO: Lógica inteligente para Nginx/HTTPS
// En Producción (PROD) BASE_URL será '' (vacío), así axios hará peticiones a /api/...
// En Desarrollo, usará localhost:3001
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

// Nota: Si BASE_URL es vacía, API_URL será "/api", que es perfecto para Nginx.
const API_URL = `${BASE_URL}/api`;

export const sendVerificationCode = async (email, recaptchaToken) => {
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