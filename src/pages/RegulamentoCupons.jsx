import { useSearchParams } from 'react-router-dom';
import { OfferPageHero } from '@/components/offers/OfferParts';
import { fetchCouponTerms } from '@/integrations/supabase/coupons';
import { useLoader } from '@/hooks/useLoader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatOfferDate } from '@/lib/offers';
import { staticPageMeta } from '@/lib/siteMeta';

/** Texto vem de coupon_terms: cada versão publicada continua consultável. */
function RegulamentoCupons() {
    usePageMeta(staticPageMeta('/regulamento-cupons'));
    const [searchParams] = useSearchParams();
    const requested = searchParams.get('versao');
    const { data, loading, error } = useLoader(() => fetchCouponTerms(requested), requested ?? 'current');
    const terms = data?.terms;

    return (
        <>
            <OfferPageHero
                crumbs={[{ label: 'Início', to: '/' }, { label: 'Regulamento dos cupons' }]}
                title="Regulamento de Utilização dos Cupons"
                subtitle="Farol Pitimbu — Ofertas do Farol"
            />
            <section className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
                <article className="container mx-auto max-w-3xl rounded-3xl bg-card p-6 shadow-sm sm:p-8">
                    {loading && !terms && (
                        <p role="status" className="text-sm text-dark-ocean/60">
                            Carregando regulamento...
                        </p>
                    )}
                    {!loading && (error || !terms) && (
                        <p role="alert" className="text-sm text-red-700">
                            {requested ? `A versão ${requested} do regulamento não foi encontrada.` : 'Não foi possível carregar o regulamento.'}
                        </p>
                    )}
                    {terms && (
                        <>
                            <p className="text-sm text-dark-ocean/60">
                                Versão {terms.version}, publicada em {formatOfferDate(terms.published_at)}.
                            </p>
                            {terms.content.map((section, index) => (
                                <section key={section.heading ?? index} className="mt-6">
                                    {section.heading && <h2 className="font-head text-xl font-bold text-foreground">{section.heading}</h2>}
                                    {section.blocks.map((block, blockIndex) =>
                                        block.list ? (
                                            <ul key={blockIndex} className="mt-2 list-disc space-y-1 pl-6 text-foreground/85">
                                                {block.list.map((item) => (
                                                    <li key={item}>{item}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p key={blockIndex} className="mt-2 text-foreground/85">
                                                {block.p}
                                            </p>
                                        )
                                    )}
                                </section>
                            ))}
                        </>
                    )}
                </article>
            </section>
        </>
    );
}

export default RegulamentoCupons;
