import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowUpRight, Bell, Loader2, Mail, Building2, User } from 'lucide-react';
import axios from 'axios';
import { clientPortalService } from '../services/clientPortalService';
import { useClientAuthStore } from '../stores/useClientAuthStore';

const ClientLogin = () => {
    const navigate = useNavigate();
    const setClientSession = useClientAuthStore((state) => state.setSession);
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const loginMutation = useMutation({
        mutationFn: async () => {
            return clientPortalService.login({
                identifier: loginIdentifier,
                password: loginPassword,
            });
        },
        onSuccess: (result) => {
            setClientSession(
                {
                    id: result.client.id,
                    name: result.client.name,
                    cnpj: result.client.cnpj,
                    email: result.client.email,
                },
            );

            navigate('/portal');
        },
        onError: (error: unknown) => {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao realizar login'
                : error instanceof Error
                    ? error.message
                    : 'Erro ao realizar login';
            setLoginError(message);
        },
    });

    const handleClientLogin = (event: React.FormEvent) => {
        event.preventDefault();
        setLoginError(null);
        loginMutation.mutate();
    };

    return (
        <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6 relative overflow-hidden font-sans">
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-sky-600/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,transparent_0%,#030712_70%)] opacity-50" />

            <div className="w-full max-w-120 relative">
                <div className="absolute -inset-1 bg-linear-to-r from-sky-600/20 to-blue-600/20 rounded-[40px] blur-xl opacity-50" />

                <div className="relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl">
                    <div className="flex rounded-2xl bg-slate-950/60 border border-white/5 p-1 mb-10">
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-all hover:bg-white/5"
                        >
                            <Building2 className="w-4 h-4" />
                            Sou Contador
                        </button>
                        <button
                            type="button"
                            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-sky-600 text-white shadow-lg shadow-sky-500/20 transition-all"
                        >
                            <User className="w-4 h-4" />
                            Sou Cliente
                        </button>
                    </div>

                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/5 border border-white/10 mb-6 shadow-highlight">
                            <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                                <Lock className="w-6 h-6" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">Portal do Cliente</h1>
                        <p className="text-slate-400 text-sm">Acesse seu dashboard financeiro com segurança</p>
                    </div>

                    <form onSubmit={handleClientLogin} className="space-y-6">
                        {loginError && (
                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-shake flex items-center gap-2">
                                <Bell className="w-4 h-4 shrink-0" />
                                {loginError}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
                                Email ou CNPJ
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-sky-500 transition-colors" />
                                <input
                                    value={loginIdentifier}
                                    onChange={(event) => setLoginIdentifier(event.target.value)}
                                    placeholder="ex: empresa@email.com ou 00.000.000/0001-00"
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
                                Senha
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-sky-500 transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={loginPassword}
                                    onChange={(event) => setLoginPassword(event.target.value)}
                                    placeholder="Digite sua senha"
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((current) => !current)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? (
                                        <ArrowUpRight className="w-5 h-5" />
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-slate-500" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loginMutation.isPending}
                            className="w-full bg-linear-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_30px_rgb(14,165,233,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group"
                        >
                            {loginMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Acessar Dashboard
                                    <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ClientLogin;
