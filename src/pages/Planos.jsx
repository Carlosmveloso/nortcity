import { ChevronRight, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { plans, planBenefits } from '../data/plans';
import PricingCard from '../components/ui/PricingCard';
import Reveal from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

const faq = [
    {
        question: 'Posso contratar um plano pago?',
        answer: 'Ainda não. Os planos pagos estão em planejamento, com preços e benefícios a definir. O cadastro gratuito já está disponível.',
    },
    {
        question: 'Meu negócio aparece assim que eu cadastro?',
        answer: 'O cadastro passa por análise da equipe antes de ser publicado. Você acompanha o status pela área Meu Negócio.',
    },
    {
        question: 'Preciso pagar para cadastrar meu negócio?',
        answer: 'Não. Você pode criar sua conta e enviar o cadastro gratuitamente.',
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
                        Cadastro gratuito disponível
                    </p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">
                        Divulgue seu negócio em Pitimbu
                    </h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Cadastre seu negócio gratuitamente para que visitantes e moradores possam encontrá-lo no Farol Pitimbu.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div className="mx-auto grid max-w-lg grid-cols-1 gap-8">
                        {plans.map((plan, index) => (
                            <Reveal key={plan.id} delay={index * 80}>
                                <PricingCard plan={plan} />
                            </Reveal>
                        ))}
                    </div>
                    <div className="mx-auto mt-8 max-w-lg rounded-3xl border border-sand-dark bg-card p-6">
                        <h2 className="font-head text-xl font-bold text-foreground">Planos pagos em planejamento</h2>
                        <p className="mt-2 text-dark-ocean/70">
                            Novos recursos de divulgação estão em estudo. Preços, benefícios e disponibilidade ainda serão definidos.
                        </p>
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
                            O que você já pode fazer com seu cadastro gratuito
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
                        Fale com nossa equipe para saber como cadastrar e divulgar seu negócio.
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
