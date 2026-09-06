import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState([]);
    const [rolesLoading, setRolesLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const userId = session?.user?.id ?? null;

    useEffect(() => {
        // Espera a sessão resolver antes de decidir se há roles a buscar —
        // sem isso, o userId=null do primeiro render (antes do getSession
        // responder) zera rolesLoading prematuramente e AdminRoute redireciona
        // antes da busca real de roles começar.
        if (loading) return undefined;

        let cancelled = false;

        async function load() {
            if (!userId) {
                setRoles([]);
                setRolesLoading(false);
                return;
            }

            setRolesLoading(true);
            const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);

            if (cancelled) return;
            setRoles(data ? data.map((row) => row.role) : []);
            setRolesLoading(false);
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [userId, loading]);

    const value = {
        session,
        user: session?.user ?? null,
        loading,
        roles,
        rolesLoading,
        isAdmin: roles.includes('admin'),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
