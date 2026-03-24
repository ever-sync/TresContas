import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
    children: ReactNode;
};

type AppErrorBoundaryState = {
    hasError: boolean;
};

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
    state: AppErrorBoundaryState = {
        hasError: false,
    };

    static getDerivedStateFromError(): AppErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Unhandled application error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#08111f] text-slate-200 flex items-center justify-center px-6">
                    <div className="max-w-md rounded-3xl border border-white/10 bg-slate-950/60 p-8 text-center shadow-2xl">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-400/70">
                            Falha na tela
                        </p>
                        <h1 className="mt-4 text-2xl font-bold text-white">Algo saiu do esperado.</h1>
                        <p className="mt-3 text-sm text-slate-400">
                            A interface encontrou um erro inesperado. Tente recarregar esta tela.
                        </p>
                        <button
                            type="button"
                            onClick={this.handleReset}
                            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
                        >
                            Tentar novamente
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AppErrorBoundary;
