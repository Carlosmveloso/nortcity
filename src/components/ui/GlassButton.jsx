function GlassButton({ children, as: Component = 'span', className = '', ...props }) {
    const styleGlass = 'inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/25 px-5 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-md';
    return (
        <Component className={`${styleGlass} ${className}`.trim()} {...props}>
            {children}
        </Component>
    );
}

export default GlassButton;
