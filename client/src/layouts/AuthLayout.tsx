import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { APP_ROUTES } from '../constants/routes';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100 p-4">
      <div className="mb-6 text-center">
        <Link to={APP_ROUTES.HOME} className="text-xl font-bold text-gray-800">
          THAI Please WebApp
        </Link>
      </div>

      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <Outlet />
      </div>
    </div>
  );
};
