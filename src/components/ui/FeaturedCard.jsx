import { featureSection } from '../../data/featureSection';
import { MessageCircle, MapPin, Star } from 'lucide-react';

function FeaturedCard() {
    return (
        <>
            {featureSection.map((featured) => {
                return (
                    <section
                        className="w-full max-w-82.5 bg-card rounded-4xl relative shadow-2xl"
                        key={featured.title}
                    >
                        <div className='h-62 overflow-hidden rounded-t-4xl'>
                            <img
                                className="w-full h-full object-cover"
                                src={featured.img}
                                alt={featured.altText}
                            />
                        </div>
                        <div className="absolute top-4 left-4 flex gap-2">
                            {featured.categories.map((categorie) => {
                                return (
                                    <span
                                        key={categorie}
                                        className=" bg-white px-2 rounded-full shadow-2xl"
                                    >
                                        {categorie}
                                    </span>
                                );
                            })}
                        </div>
                        <div className="flex flex-col p-4">
                            <p className="mb-2 font-head font-semibold text-lg text-foreground">
                                {featured.title}
                            </p>
                            <p className="flex items-center gap-1 mb-2 text-sm text-muted-foreground">
                                <MapPin size={17} className="text-turquoise" />
                                {featured.local}
                            </p>
                            <p className="flex items-center gap-1 mb-4">
                                <Star size={16} className="text-sun-yellow fill-sun-yellow" />
                                <span className="text-sm font-medium text-foreground">
                                    {featured.grade}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    ({featured.feedbacks} avaliações)
                                </span>
                            </p>
                            <p className="text-sm font-semibold text-blue-secondary">
                                a partir de R$ {featured.from}
                            </p>
                            <div className="flex items-center gap-2 justify-between py-4">
                                <a
                                    className="w-full flex justify-center items-center text-muted text-center py-2 rounded-full bg-blue-primary"
                                    href=""
                                >
                                    Ver detalhes
                                </a>
                                <a
                                    className="w-1/4 py-3 flex justify-center bg-whatsapp-green text-white rounded-4xl"
                                    href=""
                                >
                                    <MessageCircle size={18} />
                                </a>
                            </div>
                        </div>
                    </section>
                );
            })}
        </>
    );
}

export default FeaturedCard;
