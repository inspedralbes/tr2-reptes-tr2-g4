import axios from 'axios';

// 1. DEFINIMOS LA URL BASE
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

export const sendVerificationCode = async (email, tokenDeGoogle) => {
  // EL FIX ESTÁ AQUÍ:
  // El backend en la línea 65 hace: const { email, recaptchaToken } = req.body;
  // Por tanto, la clave del objeto DEBE ser 'recaptchaToken'.
  
  const response = await axios.post(`${API_URL}/login/send-code`, { 
    email: email,
    recaptchaToken: tokenDeGoogle // Asignamos el valor a la clave correcta
  });
  return response.data;
};

export const verifyCode = async (email, code) => {
  const response = await axios.post(`${API_URL}/login/verify-code`, { email, code });
  return response.data;
};