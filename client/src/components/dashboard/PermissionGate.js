'use client';

import { useAuth } from '@/context/AuthContext';

export default function PermissionGate({ permission, anyOf, allOf, fallback = null, children }) {
  const { can, canAny, canAll } = useAuth();
  const allowed = permission ? can(permission) : anyOf ? canAny(anyOf) : allOf ? canAll(allOf) : true;
  return allowed ? children : fallback;
}
