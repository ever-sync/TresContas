
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Building2, User, Mail, Briefcase, Phone, MapPin, Lock, Loader2, Eye, EyeOff, Copy, Check, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { isValidCNPJ, formatCNPJ } from '../lib/utils';
import { clientService } from '../services/clientService';
import type { Client } from '../services/clientService';
import axios from 'axios';

const clientSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cnpj: z.string().refine(isValidCNPJ, 'CNPJ inválido'),
  email: z.string().email('Email inválido'),
  representative_name: z.string().min(3, 'Nome do representante obrigatório'),
  representative_email: z.string().email('Email do representante inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
  industry: z.string().min(2, 'Ramo de atividade obrigatório'),
  address: z.string().min(5, 'Endereço obrigatório'),
  tax_regime: z.enum(['simples', 'presumido', 'real', 'mei'], {
    message: 'Selecione um regime tributário válido',
  }),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional().or(z.literal('')),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client?: Client | null;
}

export const ClientRegistrationModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, client }) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      tax_regime: 'simples',
    }
  });

  React.useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        cnpj: client.cnpj,
        email: client.email || '',
        representative_name: client.representative_name || '',
        representative_email: client.representative_email || '',
        phone: client.phone || '',
        industry: client.industry || '',
        address: client.address || '',
        tax_regime: (client.tax_regime as any) || 'simples',
        password: '',
      });
    } else {
      reset({
        tax_regime: 'simples',
        name: '',
        cnpj: '',
        email: '',
        representative_name: '',
        representative_email: '',
        phone: '',
        industry: '',
        address: '',
        password: '',
      });
    }
  }, [client, reset, isOpen]);

  const [isFetchingCNPJ, setIsFetchingCNPJ] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const cnpjValue = watch('cnpj');
  const passwordValue = watch('password');

  // Auto-fill CNPJ logic
  React.useEffect(() => {
    const rawCNPJ = cnpjValue?.replace(/\D/g, '');
    if (rawCNPJ?.length === 14) {
      const fetchData = async () => {
        setIsFetchingCNPJ(true);
        try {
          const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${rawCNPJ}`);
          const data = response.data;
          
          if (data.razao_social) setValue('name', data.razao_social);
          if (data.cnae_fiscal_descricao) setValue('industry', data.cnae_fiscal_descricao);
          if (data.email) setValue('email', data.email);
          if (data.ddd_telefone_1) setValue('phone', data.ddd_telefone_1);
          
          const fullAddress = `${data.logradouro}, ${data.numero}${data.complemento ? ' ' + data.complemento : ''}, ${data.bairro}, ${data.municipio} - ${data.uf}`;
          setValue('address', fullAddress);
          
        } catch (error) {
          console.error('Erro ao buscar CNPJ:', error);
        } finally {
          setIsFetchingCNPJ(false);
        }
      };
      fetchData();
    }
  }, [cnpjValue, setValue]);

  const handleCopyPassword = async () => {
    if (!passwordValue) return;
    try {
      await navigator.clipboard.writeText(passwordValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue('cnpj', formatCNPJ(e.target.value));
  };

  const onSubmit = async (data: ClientFormData) => {
    try {
      if (client) {
        // Clean up data for update: if password is empty, don't send it
        const updateData: any = { ...data };
        if (!updateData.password) delete updateData.password;
        await clientService.update(client.id, updateData);
      } else {
        // Criacao: senha e obrigatoria para o cliente poder logar
        if (!data.password || data.password.length < 6) {
          toast.error('Senha e obrigatoria (minimo 6 caracteres) para o cliente acessar o portal');
          return;
        }
        await clientService.create(data);
      }
      onSuccess();
      onClose();
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || 'Erro ao cadastrar cliente'
        : 'Erro ao cadastrar cliente';
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
        className="bg-[#0d1829]/95 backdrop-blur-xl rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl shadow-cyan-500/10 scrollbar-hide"
        style={{
          background: 'linear-gradient(135deg, rgba(13, 24, 41, 0.98) 0%, rgba(10, 31, 58, 0.98) 100%)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0d1829]/95 backdrop-blur-xl px-8 py-6 border-b border-white/5 flex justify-between items-center z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{client ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <p className="text-slate-500 text-sm">{client ? 'Atualize as informações da empresa' : 'Cadastre uma nova empresa no sistema'}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-8">
          {/* Informações da Empresa */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Dados da Empresa</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClasses}>Razão Social</label>
                <div className="relative">
                  <Building2 className={iconClasses} />
                  <input
                    {...register('name')}
                    placeholder="Nome da Empresa"
                    className={inputClasses}
                  />
                </div>
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <label className={labelClasses}>CNPJ</label>
                <div className="relative">
                  <Briefcase className={iconClasses} />
                  <input
                    value={cnpjValue}
                    onChange={handleCNPJChange}
                    placeholder="00.000.000/0001-00"
                    className={inputClasses}
                    disabled={isFetchingCNPJ}
                  />
                  {isFetchingCNPJ && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
                  )}
                </div>
                {errors.cnpj && <p className="text-xs text-red-400 mt-1">{errors.cnpj.message}</p>}
              </div>

              <div className="space-y-1">
                <label className={labelClasses}>Setor/Ramo</label>
                <div className="relative">
                  <Briefcase className={iconClasses} />
                  <input
                    {...register('industry')}
                    placeholder="Ex: Tecnologia"
                    className={inputClasses}
                  />
                </div>
                {errors.industry && <p className="text-xs text-red-400 mt-1">{errors.industry.message}</p>}
              </div>

              <div className="space-y-1">
                <label className={labelClasses}>Regime Tributário</label>
                <select
                  {...register('tax_regime')}
                  className={`${inputWithoutIconClasses} appearance-none cursor-pointer`}
                >
                  <option value="simples" className="bg-[#0d1829] text-white">Simples Nacional</option>
                  <option value="presumido" className="bg-[#0d1829] text-white">Lucro Presumido</option>
                  <option value="real" className="bg-[#0d1829] text-white">Lucro Real</option>
                  <option value="mei" className="bg-[#0d1829] text-white">MEI</option>
                </select>
                {errors.tax_regime && <p className="text-xs text-red-400 mt-1">{errors.tax_regime.message}</p>}
              </div>
            </div>
          </section>

          {/* Divisor */}
          <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

          {/* Endereço e Contato */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Localização e Contato</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2 space-y-1">
                <label className={labelClasses}>Endereço Completo</label>
                <div className="relative">
                  <MapPin className={iconClasses} />
                  <input
                    {...register('address')}
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    className={inputClasses}
                  />
                </div>
                {errors.address && <p className="text-xs text-red-400 mt-1">{errors.address.message}</p>}
              </div>
              
              <div className="space-y-1">
                <label className={labelClasses}>Email da Empresa</label>
                <div className="relative">
                  <Mail className={iconClasses} />
                  <input
                    {...register('email')}
                    placeholder="contato@empresa.com"
                    className={inputClasses}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
              </div>
              
              <div className="space-y-1">
                <label className={labelClasses}>Telefone</label>
                <div className="relative">
                  <Phone className={iconClasses} />
                  <input
                    {...register('phone')}
                    placeholder="(00) 00000-0000"
                    className={inputClasses}
                  />
                </div>
                {errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone.message}</p>}
              </div>
            </div>
          </section>

          {/* Divisor */}
          <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

          {/* Representante e Acesso */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center">
                <User className="w-4 h-4 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Acesso do Cliente</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClasses}>Nome do Representante</label>
                <div className="relative">
                  <User className={iconClasses} />
                  <input
                    {...register('representative_name')}
                    placeholder="Nome do Sócio/Gestor"
                    className={inputClasses}
                  />
                </div>
                {errors.representative_name && <p className="text-xs text-red-400 mt-1">{errors.representative_name.message}</p>}
              </div>
              
              <div className="space-y-1">
                <label className={labelClasses}>Email de Acesso</label>
                <div className="relative">
                  <Mail className={iconClasses} />
                  <input
                    {...register('representative_email')}
                    placeholder="email@representante.com"
                    className={inputClasses}
                  />
                </div>
                {errors.representative_email && <p className="text-xs text-red-400 mt-1">{errors.representative_email.message}</p>}
              </div>
              
              <div className="md:col-span-2 space-y-1">
                <label className={labelClasses}>
                  Senha do Cliente {!client && <span className="text-red-400">*</span>}
                  {client && <span className="text-slate-500">(deixe vazio para manter)</span>}
                </label>
                <div className="relative">
                  <Lock className={iconClasses} />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={client ? '••••••••' : 'Minimo 6 caracteres (obrigatorio)'}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-24 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-400 transition-all"
                      title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-400 transition-all"
                      title="Copiar senha"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
              </div>
            </div>
          </section>

          {/* Buttons */}
          <div className="flex gap-4 pt-6">
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
                  Cadastrando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  {client ? 'Salvar Alterações' : 'Finalizar Cadastro'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
