import api from './client';

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  username: string;
  token: string;
  tokenType: string;
  expiresInMs: number;
  message: string;
}

export const register = (data: RegisterPayload) =>
  api.post('/api/users/register', data);

export const login = (data: LoginPayload) =>
  api.post<LoginResponse>('/api/users/login', data);
