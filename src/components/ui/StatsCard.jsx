function StatsCard({ stat }) {
    const Icon = stat.icon;
    return (
        <div className='flex flex-col items-center'>
            <div className="h-16 w-16 rounded-3xl bg-card/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                <Icon className='h-8 w-8 text-card' aria-hidden="true" />
            </div>
            <div className="font-head font-bold text-card text-4xl md:text-5xl mb-2">
                {stat.total}
            </div>
            <p className="font-head font-semibold text-lg text-card mb-1">
                {stat.title}
            </p>
            <p className="text-sm text-card/70">{stat.description}</p>
        </div>
    );
}

export default StatsCard;
