import React from 'react';
import { Link } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';

export const LoginPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Sign In</h2>
      <p className="text-xs text-gray-500">
        [Skeleton Placeholder] ฟอร์ม Login - เชื่อมต่อกับ useLogin() และ Zod Schema
      </p>

      <div className="text-xs text-gray-500 pt-2 border-t">
        Don&apos;t have an account?{' '}
        <Link to={APP_ROUTES.REGISTER} className="text-blue-600 hover:underline">
          Register
        </Link>
      </div>
    </div>
  );
};
