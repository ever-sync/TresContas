import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';
import api from '../services/api';

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        try {
            setErrorMessage(null);
            const response = await api.post('/auth/login', data);
            setAuth(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao realizar login'
                : 'Erro ao realizar login';
            setErrorMessage(message);
        }
    };

    return (
        <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Ambient Glowing Background */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-sky-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_transparent_0%,_#030712_70%)] opacity-50" />

            {/* Login Card */}
            <div className="w-full max-w-[480px] relative">
                <div className="absolute -inset-1 bg-linear-to-r from-blue-600/20 to-sky-600/20 rounded-[40px] blur-xl opacity-50" />
                
                <div className="relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/5 border border-white/10 mb-6 shadow-highlight">
                            <img src="/logo.png" alt="TresContas" className="h-10 w-auto brightness-110" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo</h1>
                        <p className="text-slate-400 text-sm">Acesse sua plataforma com segurança</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {errorMessage && (
                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-shake">
                                {errorMessage}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    {...register('email')}
                                    type="email"
                                    placeholder="exemplo@trescontas.com"
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                                />
                            </div>
                            {errors.email && <p className="text-red-400 text-xs mt-1 ml-1">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Senha</label>
                                <a href="#" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">Esqueceu?</a>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    {...register('password')}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <ArrowRight className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-slate-500" />}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-400 text-xs mt-1 ml-1">{errors.password.message}</p>}
                        </div>

                        <div className="flex items-center gap-2 ml-1">
                            <input type="checkbox" id="remember" className="w-4 h-4 rounded border-white/10 bg-slate-950/50 text-blue-600 focus:ring-blue-500/20" />
                            <label htmlFor="remember" className="text-sm text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">Lembrar por 30 dias</label>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_30px_rgb(37,99,235,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Entrar no Sistema
                        </button>

                        <div className="relative flex items-center gap-4 py-2">
                            <div className="h-[1px] flex-1 bg-white/5" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">ou continuar com</span>
                            <div className="h-[1px] flex-1 bg-white/5" />
                        </div>

                        <div className="flex items-center justify-center gap-4">
                            <button type="button" className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl py-3 flex items-center justify-center transition-all group">
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </button>
                            <button type="button" className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl py-3 flex items-center justify-center transition-all group">
                                <img src="https://www.svgrepo.com/show/475631/apple-color.svg" alt="Apple" className="w-5 h-5 group-hover:scale-110 transition-transform brightness-0 invert" />
                            </button>
                        </div>
                    </form>

                    <div className="mt-10 text-center">
                        <p className="text-slate-500 text-sm">
                            Não tem conta?{' '}
                            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">Cadastre-se</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
