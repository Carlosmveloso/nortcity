import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    OFFER_STATUS_LABELS,
    OFFER_STATUS_STYLE,
    REVIEW_ACTION_LABELS,
    benefitSummary,
    couponValidityLabel,
    formatMoney,
    formatOfferDateTime,
    perUserLimitLabel,
    periodSummary,
    scheduleLines,
    totalLimitLabel,
} from '@/lib/offers';

export function OfferStatusBadge({ status, label }) {
    return (
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${OFFER_STATUS_STYLE[status] ?? ''}`}>
            {label ?? OFFER_STATUS_LABELS[status] ?? status}
        </span>
    );
}

/** Cabeçalho das páginas de ofertas, no mesmo padrão de Meu Negócio e Admin. */
export function OfferPageHero({ crumbs, title, subtitle, children, wide = false }) {
    return (
        <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
            <div className={`container mx-auto ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
                <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-card/70">
                    {crumbs.map((crumb, index) => (
                        <span key={crumb.label} className="flex items-center gap-1.5">
                            {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
                            {crumb.to ? (
                                <Link to={crumb.to} className="hover:text-card">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="text-card" aria-current="page">
                                    {crumb.label}
                                </span>
                            )}
                        </span>
                    ))}
                </nav>
                <h1 className="font-head text-3xl font-extrabold break-words text-card md:text-4xl">{title}</h1>
                {subtitle && <p className="mt-2 max-w-2xl text-card/80">{subtitle}</p>}
                {children}
            </div>
        </section>
    );
}

function Row({ label, children }) {
    return (
        <div className="grid gap-1 border-b border-sand-dark py-3 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="text-sm font-semibold text-dark-ocean/70">{label}</dt>
            <dd className="text-sm break-words text-foreground">{children}</dd>
        </div>
    );
}

/**
 * Conteúdo comercial de uma versão (ou do payload em edição, que usa as
 * mesmas chaves). Não mostra taxa: isso é assunto do bloco financeiro.
 */
export function OfferSummary({ version }) {
    if (!version) return null;
    return (
        <dl>
            <Row label="Benefício">{benefitSummary(version)}</Row>
            {version.description && (
                <Row label="Descrição">
                    <span className="whitespace-pre-line">{version.description}</span>
                </Row>
            )}
            <Row label="Período">{periodSummary(version)}</Row>
            <Row label="Dias e horários">
                <ul>
                    {scheduleLines(version).map((line) => (
                        <li key={line}>{line}</li>
                    ))}
                </ul>
            </Row>
            <Row label="Compra mínima">
                {version.minimum_purchase ? formatMoney(version.minimum_purchase) : 'Sem compra mínima'}
            </Row>
            {version.eligible_items && <Row label="Participam">{version.eligible_items}</Row>}
            <Row label="Acumula com outras promoções">{version.stackable ? 'Sim' : 'Não'}</Row>
            {version.conditions && (
                <Row label="Condições">
                    <span className="whitespace-pre-line">{version.conditions}</span>
                </Row>
            )}
            <Row label="Quantidade total">{totalLimitLabel(version.total_limit)}</Row>
            <Row label="Por pessoa">{perUserLimitLabel(version.per_user_limit)}</Row>
            <Row label="Validade do cupom">
                {version.coupon_validity_minutes
                    ? `${couponValidityLabel(version.coupon_validity_minutes)} após a geração`
                    : 'A definir'}
            </Row>
        </dl>
    );
}

/** Histórico só de leitura, do mais antigo ao mais recente. */
export function OfferHistory({ reviews, versions, actorName }) {
    if (!reviews?.length) {
        return <p className="text-sm text-dark-ocean/60">Nenhum envio registrado ainda.</p>;
    }
    const numberOf = Object.fromEntries((versions ?? []).map((version) => [version.id, version.version_number]));
    return (
        <ol className="flex flex-col gap-3">
            {reviews.map((review) => (
                <li key={review.id} className="rounded-2xl bg-sand/60 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-semibold text-foreground">
                            {REVIEW_ACTION_LABELS[review.action] ?? review.action}
                            {numberOf[review.offer_version_id] && (
                                <span className="font-normal text-dark-ocean/60"> · versão {numberOf[review.offer_version_id]}</span>
                            )}
                        </p>
                        <time dateTime={review.created_at} className="text-xs text-dark-ocean/60">
                            {formatOfferDateTime(review.created_at)}
                        </time>
                    </div>
                    {actorName && review.actor_id && <p className="mt-0.5 text-xs text-dark-ocean/60">{actorName(review.actor_id)}</p>}
                    {review.message && <p className="mt-1 text-sm whitespace-pre-line text-dark-ocean/80">{review.message}</p>}
                </li>
            ))}
        </ol>
    );
}

export function Card({ title, children, className = '', titleId }) {
    return (
        <section aria-labelledby={title ? titleId : undefined} className={`rounded-3xl bg-card p-5 shadow-sm sm:p-6 ${className}`}>
            {title && (
                <h2 id={titleId} className="font-head text-lg font-bold text-foreground">
                    {title}
                </h2>
            )}
            {children}
        </section>
    );
}
