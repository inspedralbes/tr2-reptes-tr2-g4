import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const API_URL = `${BASE_URL}/api`;

export const sendVerificationCode = async (email, recaptchaToken, isDesktop = false) => {
  const response = await axios.post(`${API_URL}/login/send-code`, { 
    email: email,
    recaptchaToken: recaptchaToken,
    isDesktop: isDesktop
  });
  return response.data;
};

export const verifyCode = async (email, code) => {
  const response = await axios.post(`${API_URL}/login/verify-code`, { email, code });
  return response.data;
};