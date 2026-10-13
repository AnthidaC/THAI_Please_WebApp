import React from 'react';
import { useAuthStore } from '../../stores/authStore';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard (Protected Area)</h1>
      <p className="text-gray-600">
        [Skeleton Placeholder] หน้า Dashboard สำหรับผู้ใช้ที่ผ่านการ Login แล้ว
      </p>
      <div className="p-4 bg-gray-100 rounded text-xs font-mono">
        Logged in as: {user?.email || 'Authenticated User'}
      </div>
    </div>
  );
};
