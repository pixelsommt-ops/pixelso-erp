import useAuthStore from '../store/authStore';

export default function useAuth() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const role = user?.role || null;
  const hasRole = (...roles) => role && roles.includes(role);

  return { user, token, role, hasRole, logout };
}
