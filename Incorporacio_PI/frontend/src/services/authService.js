import axios from 'axios';

// Asegúrate de que este puerto (3000) coincide con el de tu server.js
const API_URL = 'http://localhost:3000/api'; 

export const sendVerificationCode = async (email) => {
  // Llamada real al endpoint que acabamos de crear en server.js
  const response = await axios.post(`${API_URL}/login/send-code`, { email });
  return response.data;
};

export const verifyCode = async (email, code) => {
  const response = await axios.post(`${API_URL}/login/verify-code`, { email, code });
  return response.data;
};