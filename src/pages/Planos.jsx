import { ChevronRight, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { plans, planBenefits } from '../data/plans';
import PricingCard from '../components/ui/PricingCard';
import Reveal from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

const faq = [
    {
        question: 'Posso trocar de plano depois?',
        answer: 'Sim, você pode fazer upgrade ou downgrade do seu plano a qualquer momento pelo painel do negócio.',
    },
    {
        question: 'Existe fidelidade ou multa de cancelamento?',
        answer: 'Não. Os planos pagos são mensais e você pode cancelar quando quiser, sem multa.',
    },
    {
        question: 'O plano Básico é gratuito para sempre?',
        answer: 'Sim, o plano Básico não tem custo e não expira — é o ponto de partida para qualquer negócio local.',
    },
];

function Planos() {
    usePageMeta(staticPageMeta('/planos'));

    return (
        <>
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Planos</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">
                        Planos para todos os tamanhos
                    </p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">
                        Divulgue seu negócio em Pitimbu
                    </h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Escolha o plano ideal e seja encontrado por milhares de visitantes e moradores locais.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
                        {plans.map((plan, index) => (
                            <Reveal key={plan.id} delay={index * 80}>
                                <PricingCard plan={plan} />
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-card px-4 py-14 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <Reveal>
                        <h2 className="text-center font-head text-2xl font-bold text-foreground">
                            Por que anunciar no Farol Pitimbu?
                        </h2>
                        <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
                            Benefícios exclusivos para impulsionar seu negócio local
                        </p>
                    </Reveal>
                    <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        {planBenefits.map((benefit, index) => (
                            <Reveal key={benefit.title} delay={index * 60} className="text-center">
                                <h3 className="font-head font-semibold text-foreground">{benefit.title}</h3>
                                <p className="mt-2 text-sm text-muted-foreground">{benefit.description}</p>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <section id="perguntas-frequentes" className="bg-background px-4 py-14 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-3xl">
                    <Reveal>
                        <h2 className="text-center font-head text-2xl font-bold text-foreground">
                            Perguntas frequentes
                        </h2>
                    </Reveal>
                    <div className="mt-8 flex flex-col gap-4">
                        {faq.map((item, index) => (
                            <Reveal key={item.question} delay={index * 60} className="rounded-3xl bg-card p-6 shadow-sm">
                                <h3 className="font-head font-semibold text-foreground">{item.question}</h3>
                                <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-gradient-ocean px-4 py-14 sm:px-6 lg:px-8">
                <div className="container mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
                    <h2 className="font-head text-2xl font-bold text-card">Ainda tem dúvidas?</h2>
                    <p className="text-card/80">
                        Nossa equipe está pronta para ajudar você a escolher o melhor plano para seu negócio.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                        <a
                            href="https://wa.me/5583991134990"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-whatsapp-green px-6 py-3 font-bold text-white"
                        >
                            <MessageCircle size={18} aria-hidden="true" />
                            Falar no WhatsApp
                        </a>
                        <a
                            href="#perguntas-frequentes"
                            className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-6 py-3 font-bold text-card backdrop-blur-md"
                        >
                            Ver perguntas frequentes
                        </a>
                    </div>
                </div>
            </section>
        </>
    );
}

export default Planos;
