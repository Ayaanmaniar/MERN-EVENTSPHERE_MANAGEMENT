import { Navigate } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';
import { Loading } from './ui';

export function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
