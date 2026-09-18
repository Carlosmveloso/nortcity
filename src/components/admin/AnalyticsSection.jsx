import { businessErrorMessage } from '../../lib/businessErrors';

// Casca de toda seção do painel. Cada uma resolve o próprio estado: uma
// consulta que falha mostra o erro no lugar dela e deixa o resto da tela de pé,
// em vez de derrubar o admin inteiro.
function AnalyticsSection({ title, description, loading, error, isEmpty, emptyMessage, onRetry, children }) {
    function body() {
        if (loading) {
            return <p className="mt-4 text-sm text-dark-ocean/60">Carregando...</p>;
        }

        if (error) {
            return (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-red-600">{businessErrorMessage(error)}</p>
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-dark-ocean shadow-sm"
                        >
                            Tentar de novo
                        </button>
                    )}
                </div>
            );
        }

        if (isEmpty) {
            return <p className="mt-4 text-sm text-dark-ocean/60">{emptyMessage}</p>;
        }

        return <div className="mt-4">{children}</div>;
    }

    return (
        <section className="rounded-3xl bg-card p-5 shadow-sm">
            <h2 className="font-head text-lg font-bold text-foreground">{title}</h2>
            {description && <p className="mt-1 text-sm text-dark-ocean/60">{description}</p>}
            {body()}
        </section>
    );
}

export default AnalyticsSection;
