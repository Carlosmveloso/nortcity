import qrcode from 'qrcode-generator';
import { BadgePercent } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { COUPON_STATUS_LABELS, COUPON_STATUS_STYLE } from '@/lib/coupons';
import { benefitSummary, periodSummary } from '@/lib/offers';

/** Status em texto e cor: nunca só cor. */
export function CouponStatusBadge({ status }) {
    return (
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${COUPON_STATUS_STYLE[status] ?? ''}`}>
            {COUPON_STATUS_LABELS[status] ?? status}
        </span>
    );
}

/**
 * QR em SVG puro (escala sem perder nitidez e cabe em 375 px). O texto
 * alternativo descreve o uso; o conteúdo é só o token opaco.
 */
export function CouponQrCode({ value, label, size = 240 }) {
    const cells = useMemo(() => {
        if (!value) return null;
        const qr = qrcode(0, 'M');
        qr.addData(value);
        qr.make();
        const count = qr.getModuleCount();
        const rects = [];
        for (let row = 0; row < count; row += 1) {
            for (let col = 0; col < count; col += 1) {
                if (qr.isDark(row, col)) rects.push(`M${col + 4} ${row + 4}h1v1h-1z`);
            }
        }
        return { count: count + 8, path: rects.join('') };
    }, [value]);

    if (!cells) return null;
    return (
        <svg
            role="img"
            aria-label={label}
            viewBox={`0 0 ${cells.count} ${cells.count}`}
            width={size}
            height={size}
            shapeRendering="crispEdges"
            className="h-auto w-full max-w-[15rem] rounded-2xl bg-white"
        >
            <rect width={cells.count} height={cells.count} fill="#ffffff" />
            <path d={cells.path} fill="#06394a" />
        </svg>
    );
}

/** Card público: só benefício, título, período, condição principal e disponibilidade. */
export function PublicOfferCard({ offer, businessName }) {
    const version = offer.version;
    const mainCondition = version.minimum_purchase
        ? `Compra mínima de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(version.minimum_purchase))}`
        : version.eligible_items;
    return (
        <li>
            <Link
                to={`/ofertas/${offer.id}`}
                className="flex h-full flex-col gap-2 rounded-3xl border border-turquoise/20 bg-turquoise/5 p-5 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-turquoise focus-visible:outline-none"
            >
                <span className="flex items-center gap-2 text-sm font-bold text-ocean">
                    <BadgePercent size={18} aria-hidden="true" />
                    {benefitSummary(version)}
                </span>
                <span className="font-head text-lg font-bold break-words text-foreground">{version.title}</span>
                {businessName && <span className="text-sm text-dark-ocean/70">{businessName}</span>}
                <span className="text-sm text-dark-ocean/70">Válida de {periodSummary(version)}</span>
                {mainCondition && <span className="text-sm text-dark-ocean/70">{mainCondition}</span>}
                <span
                    className={`mt-auto self-start rounded-full px-3 py-1 text-xs font-semibold ${
                        offer.available ? 'bg-turquoise/15 text-ocean' : 'bg-sand-dark text-dark-ocean'
                    }`}
                >
                    {offer.available ? 'Cupons disponíveis' : 'Cupons temporariamente esgotados'}
                </span>
            </Link>
        </li>
    );
}
