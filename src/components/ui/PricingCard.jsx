import { Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';

function PricingCard({ plan }) {
    return (
        <article
            className={`relative flex flex-col rounded-3xl p-6 sm:p-8 ${
                plan.featured ? 'bg-gradient-ocean text-card shadow-xl sm:scale-105' : 'bg-card text-foreground shadow-sm'
            }`}
        >
            {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sun-yellow px-4 py-1 text-xs font-bold whitespace-nowrap text-dark-ocean">
                    {plan.badge}
                </span>
            )}
            <h3 className="font-head text-xl font-bold">{plan.name}</h3>
            <p className={`mt-1 text-sm ${plan.featured ? 'text-card/80' : 'text-muted-foreground'}`}>{plan.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
                <span className="font-head text-3xl font-extrabold">{plan.price}</span>
                <span className={`text-sm ${plan.featured ? 'text-card/80' : 'text-muted-foreground'}`}>
                    {plan.period}
                </span>
            </div>
            <ul className="mt-6 flex flex-col gap-3">
                {plan.features.map((feature) => (
                    <li
                        key={feature.text}
                        className={`flex items-center gap-3 text-sm ${
                            feature.included ? '' : plan.featured ? 'text-card/50' : 'text-muted-foreground/60'
                        }`}
                    >
                        {feature.included ? (
                            <Check
                                size={18}
                                className={`shrink-0 ${plan.featured ? 'text-card' : 'text-blue-secondary'}`}
                                aria-hidden="true"
                            />
                        ) : (
                            <X size={18} className="shrink-0" aria-hidden="true" />
                        )}
                        {feature.text}
                    </li>
                ))}
            </ul>
            <Link
                to="/cadastrar-negocio"
                className={`mt-8 rounded-full py-3 text-center font-bold ${
                    plan.featured ? 'bg-white text-dark-ocean' : 'bg-blue-primary text-muted'
                }`}
            >
                {plan.cta}
            </Link>
        </article>
    );
}

export default PricingCard;
