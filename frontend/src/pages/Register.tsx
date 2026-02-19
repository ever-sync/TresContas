
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LayoutDashboard, Mail, Lock, Building, FileText, Phone, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { formatCNPJ, formatPhone, isValidCNPJ } from '../lib/utils';
import axios from 'axios';
import api from '../services/api';

const registerSchema = z.object({
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    cnpj: z.string().refine(isValidCNPJ, 'CNPJ inválido'),
    email: z.string().email('Email inválido'),
    phone: z.string().min(10, 'Telefone inválido'),
    password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

const Register = () => {
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const cnpjValue = watch('cnpj');
    const phoneValue = watch('phone');

    useEffect(() => {
        if (cnpjValue) {
            setValue('cnpj', formatCNPJ(cnpjValue));
        }
    }, [cnpjValue, setValue]);

    useEffect(() => {
        if (phoneValue) {
            setValue('phone', formatPhone(phoneValue));
        }
    }, [phoneValue, setValue]);

    const onSubmit = async (data: RegisterFormData) => {
        try {
            setIsLoading(true);
            setErrorMessage(null);
            const response = await api.post('/auth/register', data);
            setAuth(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao realizar cadastro'
                : 'Erro ao realizar cadastro';
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Ambient Glowing Background */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-cyan-600/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
            
            {/* Register Card */}
            <div className="w-full max-w-[560px] relative z-10">
                <div className="absolute -inset-1 bg-linear-to-r from-cyan-600/20 to-blue-600/20 rounded-[40px] blur-xl opacity-50" />
                
                <div className="relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/5 border border-white/10 mb-6 shadow-highlight">
                            <LayoutDashboard className="w-10 h-10 text-cyan-500" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Crie sua conta</h1>
                        <p className="text-slate-400 text-sm">Simplifique a gestão contábil do seu escritório</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {errorMessage && (
                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-shake">
                                {errorMessage}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Nome do Escritório</label>
                            <div className="relative group">
                                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                                <input
                                    {...register('name')}
                                    type="text"
                                    placeholder="Ex: Contabilidade Master"
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all font-sans"
                                />
                            </div>
                            {errors.name && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">CNPJ</label>
                                <div className="relative group">
                                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                                    <input
                                        {...register('cnpj')}
                                        type="text"
                                        placeholder="00.000.000/0000-00"
                                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all font-sans"
                                    />
                                </div>
                                {errors.cnpj && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.cnpj.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Telefone</label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                                    <input
                                        {...register('phone')}
                                        type="text"
                                        placeholder="(00) 00000-0000"
                                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all font-sans"
                                    />
                                </div>
                                {errors.phone && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.phone.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Email Profissional</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                                <input
                                    {...register('email')}
                                    type="email"
                                    placeholder="contato@escritorio.com"
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all font-sans"
                                />
                            </div>
                            {errors.email && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Senha de Acesso</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                                <input
                                    {...register('password')}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all font-sans"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.password.message}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-2xl shadow-[0_8px_30px_rgb(8,145,178,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Criar Minha Conta
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-slate-500 text-sm">
                            Já possui uma conta? {' '}
                            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">Acesse aqui</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
