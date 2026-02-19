import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, User, Mail, Phone, Lock, Loader2, Eye, EyeOff, Sparkles, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../services/userService';
import type { User as UserType } from '../services/userService';
import axios from 'axios';

const userSchema = z.object({
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    email: z.string().email('Email inválido'),
    phone: z.string().optional().or(z.literal('')),
    role: z.enum(['admin', 'collaborator'], {
        message: 'Selecione um papel válido',
    }),
    password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').optional().or(z.literal('')),
});

type UserFormData = z.infer<typeof userSchema>;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user?: UserType | null;
}

export const UserModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, user }) => {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            role: 'collaborator',
        },
    });

    const [showPassword, setShowPassword] = React.useState(false);

    React.useEffect(() => {
        if (user) {
            reset({
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                role: user.role,
                password: '',
            });
        } else {
            reset({
                name: '',
                email: '',
                phone: '',
                role: 'collaborator',
                password: '',
            });
        }
    }, [user, reset, isOpen]);

    const onSubmit = async (data: UserFormData) => {
        try {
            if (user) {
                const updateData: any = { ...data };
                if (!updateData.password) delete updateData.password;
                await userService.update(user.id, updateData);
            } else {
                if (!data.password) {
                    toast.error('Senha e obrigatoria para novos colaboradores');
                    return;
                }
                await userService.create({
                    name: data.name,
                    email: data.email,
                    password: data.password,
                    role: data.role,
                    phone: data.phone || undefined,
                });
            }
            onSuccess();
            onClose();
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao salvar colaborador'
                : 'Erro ao salvar colaborador';
            toast.error(message);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all";
    const inputWithoutIconClasses = "w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all";
    const labelClasses = "text-sm font-medium text-slate-300 mb-1 block";
    const iconClasses = "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a1628]/80 backdrop-blur-md">
            <div
                className="bg-[#0d1829]/95 backdrop-blur-xl rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl shadow-cyan-500/10 scrollbar-hide"
                style={{
                    background: 'linear-gradient(135deg, rgba(13, 24, 41, 0.98) 0%, rgba(10, 31, 58, 0.98) 100%)',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }}
            >
                {/* Header */}
                <div className="sticky top-0 bg-[#0d1829]/95 backdrop-blur-xl px-8 py-6 border-b border-white/5 flex justify-between items-center z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-purple-500/20 to-blue-600/20 border border-purple-500/30 flex items-center justify-center">
                            <User className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">{user ? 'Editar Colaborador' : 'Novo Colaborador'}</h2>
                            <p className="text-slate-500 text-sm">{user ? 'Atualize as informações' : 'Adicione um membro à equipe'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
                    {/* Nome */}
                    <div className="space-y-1">
                        <label className={labelClasses}>Nome Completo</label>
                        <div className="relative">
                            <User className={iconClasses} />
                            <input
                                {...register('name')}
                                placeholder="Nome do colaborador"
                                className={inputClasses}
                            />
                        </div>
                        {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                        <label className={labelClasses}>Email</label>
                        <div className="relative">
                            <Mail className={iconClasses} />
                            <input
                                {...register('email')}
                                type="email"
                                placeholder="email@escritorio.com"
                                className={inputClasses}
                            />
                        </div>
                        {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                        <label className={labelClasses}>Telefone <span className="text-slate-500">(opcional)</span></label>
                        <div className="relative">
                            <Phone className={iconClasses} />
                            <input
                                {...register('phone')}
                                placeholder="(00) 00000-0000"
                                className={inputClasses}
                            />
                        </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-1">
                        <label className={labelClasses}>Papel</label>
                        <div className="relative">
                            <Shield className={iconClasses} />
                            <select
                                {...register('role')}
                                className={`${inputClasses} appearance-none cursor-pointer`}
                            >
                                <option value="collaborator" className="bg-[#0d1829] text-white">Colaborador</option>
                                <option value="admin" className="bg-[#0d1829] text-white">Administrador</option>
                            </select>
                        </div>
                        {errors.role && <p className="text-xs text-red-400 mt-1">{errors.role.message}</p>}
                    </div>

                    {/* Password */}
                    <div className="space-y-1">
                        <label className={labelClasses}>
                            Senha {user && <span className="text-slate-500">(deixe vazio para manter)</span>}
                        </label>
                        <div className="relative">
                            <Lock className={iconClasses} />
                            <input
                                {...register('password')}
                                type={showPassword ? 'text' : 'password'}
                                placeholder={user ? '••••••••' : 'Mínimo 8 caracteres'}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-400 transition-all"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3.5 bg-white/5 border border-white/10 text-slate-300 font-medium rounded-xl hover:bg-white/10 hover:text-white transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-linear-to-r from-cyan-500 to-blue-600 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    {user ? 'Salvar Alterações' : 'Adicionar Colaborador'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
