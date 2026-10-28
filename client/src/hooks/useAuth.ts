import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/authApi';
import { useAuthStore } from '../stores/authStore';

export const useLogin = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.demoLogin('CITIZEN'),
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.token);
      queryClient.setQueryData(['currentUser'], data.data.user);
    },
  });
};

export const useCurrentUser = () => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await authApi.getMe();
      return res.data;
    },
    enabled: isAuthenticated,
  });
};
