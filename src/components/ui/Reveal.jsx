import { useInView } from '../../hooks/useInView';

function Reveal({ children, as: Tag = 'div', delay = 0, className = '', style, ...rest }) {
    const [ref, isInView] = useInView();

    return (
        <Tag
            ref={ref}
            className={`transition-all duration-700 ease-out ${
                isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } ${className}`}
            style={{ ...style, transitionDelay: `${delay}ms` }}
            {...rest}
        >
            {children}
        </Tag>
    );
}

export default Reveal;
