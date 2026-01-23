import axios from 'axios';

// Lògica URL (Igual que tenies)
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const API_URL = `${BASE_URL}/api`;

// 1. MODIFICAT: Ja no acceptem recaptchaToken
export const sendVerificationCode = async (email) => {
  const response = await axios.post(`${API_URL}/login/send-code`, { 
    email: email
    // recaptchaToken: ELIMINAT
  });
  return response.data;
};

export const verifyCode = async (email, code) => {
  const response = await axios.post(`${API_URL}/login/verify-code`, { email, code });
  return response.data;
};