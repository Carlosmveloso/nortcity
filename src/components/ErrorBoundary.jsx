import { Component } from 'react';

class ErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Erro não tratado na aplicação:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <section className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
                    <h1 className="font-head text-3xl font-extrabold text-dark-ocean md:text-4xl">
                        Algo deu errado
                    </h1>
                    <p className="max-w-md text-dark-ocean/70">
                        Encontramos um problema inesperado. Tente voltar para a home e navegar novamente.
                    </p>
                    <a
                        href="/"
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
                    >
                        Voltar para a home
                    </a>
                </section>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
