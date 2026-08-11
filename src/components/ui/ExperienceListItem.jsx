import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

function ExperienceListItem({ item, index }) {
    return (
        <li className="flex flex-col gap-3 border-b border-dark-ocean/10 py-6 last:border-none sm:flex-row sm:items-start sm:gap-4 sm:py-5">
            {item.image ? (
                <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="h-40 w-full shrink-0 rounded-2xl object-cover sm:h-16 sm:w-16"
                />
            ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-ocean font-head font-bold text-card">
                    {index}
                </span>
            )}
            <div>
                <h3 className="font-head text-lg font-semibold text-foreground">{item.title}</h3>
                {item.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                )}
                {item.address && (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin size={16} className="mt-0.5 shrink-0 text-turquoise" aria-hidden="true" />
                        {item.address}
                    </p>
                )}
                {item.link && (
                    <Link
                        to={item.link}
                        className="mt-2 inline-block text-sm font-semibold text-turquoise hover:underline"
                    >
                        Ver perfil completo →
                    </Link>
                )}
            </div>
        </li>
    );
}

export default ExperienceListItem;
