import { useEffect, useRef, useState } from 'react';

export function useInView(options) {
    const ref = useRef(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true);
                observer.unobserve(node);
            }
        }, options ?? { threshold: 0.15, rootMargin: '0px 0px -80px 0px' });

        observer.observe(node);
        return () => observer.disconnect();
    }, [options]);

    return [ref, isInView];
}
