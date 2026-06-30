//* Categorias Principais
import { categoriesSection } from '../../data/categoriesSection';
import GlassButtonMini from '../ui/GlassButtonMini';

function CategoriesSection() {
    return (
        <>
            <section className="bg-white">
                <section className='flex flex-col items-center pb-10'>
                    <h1 className='text-center pt-15 pb-5 font-head font-extrabold text-3xl font-stretch-expanded'>{categoriesSection.title}</h1>
                    <p className='text-center text-balance text-dark-ocean/80'>{categoriesSection.description}</p>
                </section>
                <section className="grid grid-cols-2 gap-4 p-4">
                    {categoriesSection.categories.map((category) => {
                        return (
                            <section
                                key={category.title}
                                style={{ backgroundImage: `url(${category.img})` }}
                                className="h-48 relative rounded-3xl bg-cover bg-center overflow-hidden text-sand"
                            >
                                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent"></div>
                                <div className="relative z-10 flex h-full flex-col justify-end p-4 text-white">
                                    <h3 className="text-lg/8 font-bold">{category.title}</h3>
                                    <p className='text-balance mb-2'>{category.subCategories.join(' e ')}</p>
                                    <GlassButtonMini>{category.options}</GlassButtonMini>
                                </div>
                            </section>
                        );
                    })}
                </section>
            </section>
        </>
    );
}

export default CategoriesSection;
