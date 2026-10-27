import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { getPaymentPinStatus } from '../services/paymentApi';

export const usePaymentPinStatus = () => {
  const { token, user, isAuthenticated } = useAuthStore();
  let role = user?.role?.toUpperCase();
  // Session claims are used only to choose UI; the server verifies the signed token.
  try {
    if (token?.split('.').length === 3) {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      role = JSON.parse(atob(payload)).role?.toUpperCase() || role;
    }
  } catch { /* The server handles invalid sessions. */ }
  if (token === 'demo-token-merchant') role = 'MERCHANT';
  const isPaymentCitizen = Boolean(isAuthenticated && token && (role === 'USER' || role === 'CITIZEN'));
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
