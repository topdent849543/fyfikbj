import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://fyfikbj-production.up.railway.app/api';
const api = axios.create({ baseURL: API_URL, timeout: 20000, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use((response) => response.data, async (error) => {
  if (error.response?.status === 401) {
    await AsyncStorage.multiRemove(['token', 'user']);
  }
  return Promise.reject(error.response?.data || error);
});
export const errorText = (error, fallback = 'حدث خطأ غير متوقع') => error?.error || error?.message || fallback;
export default api;
