import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="min-h-screen bg-background" />;
    }

    if (!user) {
        return <Navigate to="/entrar" state={{ from: location.pathname }} replace />;
    }

    return children;
}
