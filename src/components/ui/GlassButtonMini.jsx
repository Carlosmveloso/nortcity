function GlassButtonMini({children}) {
    const styleGlass = 'inline-flex w-fit items-center gap-2 rounded-full border border-white/35 bg-white/25 px-3 text-sm text-white shadow-sm backdrop-blur-md';
    return (
        <>
            <p className={`${styleGlass}`}>
                {children}
            </p>
        </>
    );
}

export default GlassButtonMini;
