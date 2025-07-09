import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { login as authLogin, logout as authLogout, getSession, type AuthUser } from '@/lib/auth';
import { useLocation } from 'wouter';

export function useAuth() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();
  
  // Query session data
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ['/api/auth/session'],
    queryFn: async () => {
      try {
        const data = await getSession();
        return data;
      } catch (error) {
        return null;
      }
    },
    initialData: null
  });
  
  // Check authentication on mount
  useEffect(() => {
    if (!isLoading) {
      setLoading(false);
    }
  }, [isLoading]);
  
  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return await authLogin(email, password);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/auth/session'], data);
    }
  });
  
  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await authLogout();
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/auth/session'], null);
      navigate('/login');
    }
  });
  
  // Login handler
  const login = useCallback(async (email: string, password: string) => {
    return loginMutation.mutateAsync({ email, password });
  }, [loginMutation]);
  
  // Logout handler
  const logout = useCallback(async () => {
    return logoutMutation.mutateAsync();
  }, [logoutMutation]);
  
  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    isLoginPending: loginMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
    error: loginMutation.error || logoutMutation.error,
    refetchUser: refetch
  };
}
