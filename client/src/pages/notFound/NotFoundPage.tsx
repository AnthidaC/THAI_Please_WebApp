import React from 'react';
import { Link } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="text-center py-16 space-y-4">
      <h1 className="text-4xl font-extrabold text-gray-800">404</h1>
      <p className="text-gray-600">Page not found</p>
      <Link
        to={APP_ROUTES.HOME}
        className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
      >
        Back to Home
      </Link>
    </div>
  );
};
