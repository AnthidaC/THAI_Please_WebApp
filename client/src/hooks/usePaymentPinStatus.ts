import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { getPaymentPinStatus } from '../services/paymentApi';

export const usePaymentPinStatus = () => {
  const { token, user, isAuthenticated } = useAuthStore();
  const isPaymentCitizen = Boolean(isAuthenticated && token && user?.role === 'USER');
  const query = useQuery({
    queryKey: ['payment-pin-status', token],
    queryFn: getPaymentPinStatus,
    enabled: isPaymentCitizen,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: false,
  });
  return { ...query, isPaymentCitizen };
};
