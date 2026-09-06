import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function AdminRoute({ children }) {
    const { user, loading, isAdmin, rolesLoading } = useAuth();
    const location = useLocation();

    if (loading || rolesLoading) {
        return <div className="min-h-screen bg-background" />;
    }

    if (!user) {
        return <Navigate to="/entrar" state={{ from: location.pathname }} replace />;
    }

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return children;
}
