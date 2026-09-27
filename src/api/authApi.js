import { httpClient } from './httpClient.js';

export const login = (email, password) => httpClient.post(
  '/api/auth/login',
  { email, password },
  { notifyUnauthorized: false },
);

export const getCurrentUser = () => httpClient.get('/api/auth/me', { notifyUnauthorized: false });
export const logout = () => httpClient.post('/api/auth/logout');
