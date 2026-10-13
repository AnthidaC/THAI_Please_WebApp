import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { APP_ROUTES } from '../constants/routes';
import { useAuthStore } from '../stores/authStore';

export const RootLayout: React.FC = () => {
  const { isAuthenticated, clearAuth } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      {/* Architectural Shell Header */}
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link to={APP_ROUTES.HOME} className="font-bold text-lg">
            THAI Please
          </Link>
          <nav className="flex items-center space-x-4 text-sm">
            <Link to={APP_ROUTES.HOME} className="text-gray-600 hover:text-gray-900">
              Home
            </Link>
            {isAuthenticated && (
              <Link to={APP_ROUTES.DASHBOARD} className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center space-x-4 text-sm">
          {isAuthenticated ? (
            <button
              onClick={clearAuth}
              className="text-red-600 hover:underline cursor-pointer"
            >
              Sign out
            </button>
          ) : (
            <div className="space-x-3">
              <Link to={APP_ROUTES.LOGIN} className="text-blue-600 hover:underline">
                Login
              </Link>
              <Link to={APP_ROUTES.REGISTER} className="text-blue-600 hover:underline">
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Page Content Outlet */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        <Outlet />
      </main>

      {/* Architectural Shell Footer */}
      <footer className="border-t bg-white px-6 py-4 text-center text-xs text-gray-500">
        THAI Please WebApp Architecture &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
