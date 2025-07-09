import { apiRequest } from './queryClient';

export type UserRole = 'platform_admin' | 'restaurant' | 'user';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  restaurantId?: number;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiRequest('POST', '/api/auth/login', { email, password });
  const data = await res.json();
  return data.user;
}

export async function logout(): Promise<void> {
  await apiRequest('POST', '/api/auth/logout');
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/session', {
      credentials: 'include'
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        return null;
      }
      throw new Error('Failed to get session');
    }
    
    const data = await res.json();
    return data.user;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}
