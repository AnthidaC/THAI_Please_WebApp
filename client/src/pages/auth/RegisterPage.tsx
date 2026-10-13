import React from 'react';
import { Link } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';

export const RegisterPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Create Account</h2>
      <p className="text-xs text-gray-500">
        [Skeleton Placeholder] ฟอร์ม Register - เชื่อมต่อกับ useRegister()
      </p>

      <div className="text-xs text-gray-500 pt-2 border-t">
        Already have an account?{' '}
        <Link to={APP_ROUTES.LOGIN} className="text-blue-600 hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
};
