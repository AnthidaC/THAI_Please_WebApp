import React from 'react';
import { useAuthStore } from '../../stores/authStore';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
          TP
        </div>
        <span className="font-semibold text-lg text-gray-800">THAI Please WebApp</span>
      </div>

      <div className="flex items-center space-x-4">
        {isAuthenticated ? (
          <>
            <span className="text-sm text-gray-600">
              Welcome, <strong className="text-gray-900">{user?.name || user?.email || 'User'}</strong>
            </span>
            <button
              onClick={clearAuth}
              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition border border-red-200"
            >
              Sign Out
            </button>
          </>
        ) : (
          <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
            Guest Session
          </span>
        )}
      </div>
    </nav>
  );
};
