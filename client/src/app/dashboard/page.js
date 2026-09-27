'use client';

import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import CompanyAdminDashboard from '@/components/dashboard/CompanyAdminDashboard';
import CompanyDriverDashboard from '@/components/dashboard/CompanyDriverDashboard';
import CompanyManagerDashboard from '@/components/dashboard/CompanyManagerDashboard';
import CustomerDashboard from '@/components/dashboard/CustomerDashboard';
import PlatformAdminDashboard from '@/components/dashboard/PlatformAdminDashboard';
import PlatformDriverDashboard from '@/components/dashboard/PlatformDriverDashboard';
import PlatformOwnerDashboard from '@/components/dashboard/PlatformOwnerDashboard';

function DashboardContent() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  if (roles.includes('platform_owner')) return <PlatformOwnerDashboard />;
  if (roles.includes('platform_admin') || roles.includes('legacy_platform_operator') || user?.role === 'admin' || user?.role === 'manager') return <PlatformAdminDashboard />;
  if (roles.includes('company_manager') || user?.role === 'merchant') return <CompanyManagerDashboard />;
  if (roles.includes('company_admin')) return <CompanyAdminDashboard />;
  if (roles.includes('platform_driver') || user?.role === 'driver') return <PlatformDriverDashboard />;
  if (roles.includes('company_driver')) return <CompanyDriverDashboard />;
  return <CustomerDashboard />;
}

export default function DashboardPage() {
  return <RequireAuth><DashboardContent /></RequireAuth>;
}
