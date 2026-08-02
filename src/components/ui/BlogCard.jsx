import { Calendar, Clock } from 'lucide-react';

function formatDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function BlogCard({ post }) {
    return (
        <article className="flex flex-col overflow-hidden rounded-3xl bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-28 items-end bg-gradient-ocean p-5">
                <span className="rounded-full border border-white/35 bg-white/25 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                    {post.category}
                </span>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
                <h3 className="font-head text-lg font-semibold text-foreground">{post.title}</h3>
                <p className="text-sm text-foreground/80">{post.excerpt}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <Calendar size={14} aria-hidden="true" />
                        {formatDate(post.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Clock size={14} aria-hidden="true" />
                        {post.readTime} de leitura
                    </span>
                    <span>{post.author}</span>
                </div>
            </div>
        </article>
    );
}

export default BlogCard;
