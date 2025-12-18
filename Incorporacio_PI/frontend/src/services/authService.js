// services/authService.js
import axios from 'axios';

// CAMBIO: Apuntamos al puerto 3001
const API_URL = 'http://localhost:3001/api'; 

export const sendVerificationCode = async (email) => {
  const response = await axios.post(`${API_URL}/login/send-code`, { email });
  return response.data;
};

export const verifyCode = async (email, code) => {
  const response = await axios.post(`${API_URL}/login/verify-code`, { email, code });
  return response.data;
};