import { fetchBusinessPublicOffers } from '@/integrations/supabase/coupons';
import { useLoader } from '@/hooks/useLoader';
import { PublicOfferCard } from './CouponParts';

/** Ofertas no ar do negócio. Sem ofertas, a seção não aparece. */
export default function BusinessOffers({ businessId }) {
    const { data } = useLoader(() => fetchBusinessPublicOffers(businessId), businessId, Boolean(businessId));
    const offers = data?.offers ?? [];
    if (offers.length === 0) return null;
    return (
        <section aria-labelledby="business-offers" className="rounded-3xl bg-card p-6 shadow-sm">
            <h2 id="business-offers" className="font-head text-xl font-bold text-foreground">
                Ofertas do Farol
            </h2>
            <p className="mt-1 text-sm text-dark-ocean/70">Gere seu cupom e apresente no estabelecimento.</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {offers.map((offer) => (
                    <PublicOfferCard key={offer.id} offer={offer} />
                ))}
            </ul>
        </section>
    );
}
