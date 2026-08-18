import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { blogPosts, blogCategories } from '../data/blogPosts';
import BlogCard from '../components/ui/BlogCard';
import Reveal from '../components/ui/Reveal';
import SEO from '../components/SEO';

function Blog() {
    const [activeCategory, setActiveCategory] = useState('');

    const results = useMemo(() => {
        const filtered = blogPosts.filter((post) => !activeCategory || post.category === activeCategory);
        return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
    }, [activeCategory]);

    return (
        <>
            <SEO
                title="Blog"
                description="Histórias e guias de Pitimbu: leia, planeje e descubra a região com quem conhece de perto."
            />
            <section className="bg-gradient-ocean px-4 pt-28 pb-14 sm:px-6 lg:px-8 lg:pt-32">
                <div className="container mx-auto max-w-5xl">
                    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-card/70">
                        <Link to="/" className="hover:text-card">
                            Início
                        </Link>
                        <ChevronRight size={14} aria-hidden="true" />
                        <span className="text-card">Blog</span>
                    </nav>
                    <p className="text-sm font-bold tracking-wide text-turquoise-light uppercase">Blog</p>
                    <h1 className="mt-2 font-head text-3xl font-extrabold text-card md:text-4xl">
                        Histórias e guias de Pitimbu
                    </h1>
                    <p className="mt-2 max-w-2xl text-card/80">
                        Leia, planeje e descubra a região com quem conhece de perto.
                    </p>
                </div>
            </section>

            <section className="bg-background px-4 py-10 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-5xl">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveCategory('')}
                            aria-pressed={activeCategory === ''}
                            className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                activeCategory === '' ? 'bg-turquoise text-sand' : 'bg-white text-dark-ocean shadow-sm'
                            }`}
                        >
                            Todas
                        </button>
                        {blogCategories.map((category) => (
                            <button
                                key={category}
                                type="button"
                                onClick={() => setActiveCategory(activeCategory === category ? '' : category)}
                                aria-pressed={activeCategory === category}
                                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                    activeCategory === category
                                        ? 'bg-turquoise text-sand'
                                        : 'bg-white text-dark-ocean shadow-sm'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {results.map((post, index) => (
                            <Reveal key={post.id} delay={index * 60}>
                                <BlogCard post={post} />
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}

export default Blog;
