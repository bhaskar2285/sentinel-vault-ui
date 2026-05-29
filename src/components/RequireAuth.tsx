import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '@/store/session';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const jwt = useSession((s) => s.jwt);
  const loc = useLocation();
  if (!jwt) return <Navigate to="/login" state={{ from: loc }} replace />;
  return <>{children}</>;
}
