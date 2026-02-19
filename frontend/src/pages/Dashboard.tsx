import { useState, useEffect } from 'react';
import {
    Users,
    Plus,
    Search,
    Bell,
    Settings,
    LogOut,
    Briefcase,
    Home,
    BarChart3,
    FileText,
    LifeBuoy,
    HelpCircle,
    Building2,
    MoreVertical,
    Edit2,
    ChevronRight,
    Shield,
    UserPlus,
    Trash2
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { clientService } from '../services/clientService';
import type { Client } from '../services/clientService';
import { supportService } from '../services/supportService';
import type { SupportTicket } from '../services/supportService';
import { userService } from '../services/userService';
import type { User as TeamUser } from '../services/userService';
import { ClientRegistrationModal } from '../components/ClientRegistrationModal';
import { UserModal } from '../components/UserModal';

const Dashboard = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<Client[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'personal' | 'team'>('personal');
    const [activeView, setActiveView] = useState<'dashboard' | 'clients' | 'support' | 'team'>('dashboard');
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    const [isSupportLoading, setIsSupportLoading] = useState(false);
    const [supportFilter, setSupportFilter] = useState<'open' | 'in_progress' | 'closed' | 'all'>('open');

    // Team management state
    const [teamMembers, setTeamMembers] = useState<TeamUser[]>([]);
    const [isTeamLoading, setIsTeamLoading] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

    const isAdmin = user?.role === 'admin';

    const fetchClients = async () => {
        try {
            setIsLoading(true);
            const data = await clientService.getAll();
            setClients(data);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                logout();
                navigate('/login');
                return;
            }
            console.error('Error fetching clients:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const handleToggleStatus = async (e: React.MouseEvent, client: Client) => {
        e.stopPropagation();
        try {
            const newStatus = client.status === 'active' ? 'inactive' : 'active';
            await clientService.update(client.id, { status: newStatus });
            fetchClients();
        } catch (error) {
            console.error('Erro ao alternar status:', error);
        }
    };

    const handleEditClient = (e: React.MouseEvent, client: Client) => {
        e.stopPropagation();
        setEditingClient(client);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingClient(null);
    };

    const fetchSupportTickets = async (status?: SupportTicket['status']) => {
        try {
            setIsSupportLoading(true);
            const data = await supportService.getAll(status);
            setSupportTickets(data);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                logout();
                navigate('/login');
                return;
            }
            console.error('Error fetching support tickets:', error);
        } finally {
            setIsSupportLoading(false);
        }
    };

    useEffect(() => {
        if (activeView === 'support') {
            fetchSupportTickets(supportFilter === 'all' ? undefined : supportFilter);
        }
    }, [activeView, supportFilter]);

    const fetchTeamMembers = async () => {
        try {
            setIsTeamLoading(true);
            const data = await userService.getAll();
            setTeamMembers(data);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                logout();
                navigate('/login');
                return;
            }
            console.error('Error fetching team:', error);
        } finally {
            setIsTeamLoading(false);
        }
    };

    useEffect(() => {
        if (activeView === 'team' || activeView === 'dashboard') {
            fetchTeamMembers();
        }
    }, [activeView]);

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Tem certeza que deseja remover este colaborador?')) return;
        try {
            await userService.delete(userId);
            toast.success('Colaborador removido com sucesso');
            fetchTeamMembers();
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao remover colaborador'
                : 'Erro ao remover colaborador';
            toast.error(message);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.cnpj.includes(searchTerm)
    );

    const filteredTickets = supportTickets.filter(ticket => {
        const term = searchTerm.toLowerCase();
        return (
            ticket.subject.toLowerCase().includes(term) ||
            ticket.client.name.toLowerCase().includes(term) ||
            ticket.client.cnpj.includes(term)
        );
    });

    // Get current greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bom dia';
        if (hour < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    // Stats mock data
    const totalClients = clients.length;
    const pendingTasks = 12; // Mock data

    return (
        <div className="h-screen bg-[#0a1628] flex overflow-hidden" style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%)'
        }}>
            {/* Sidebar - Fixed */}
            <aside className="fixed left-0 top-0 w-20 h-screen bg-[#0d1829]/80 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-6 gap-2 z-50">
                {/* Logo */}
                <div className="w-12 h-12 bg-linear-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-cyan-500/20">
                    <span className="text-white font-bold text-xl">T</span>
                </div>

                {/* Nav Icons */}
                <nav className="flex-1 flex flex-col items-center gap-2">
                    <button 
                        onClick={() => setActiveView('dashboard')}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-105 ${
                            activeView === 'dashboard' 
                                ? 'bg-linear-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400' 
                                : 'hover:bg-white/5 text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <Home className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setActiveView('clients')}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-105 ${
                            activeView === 'clients' 
                                ? 'bg-linear-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400' 
                                : 'hover:bg-white/5 text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <Users className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setActiveView('support')}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-105 ${
                            activeView === 'support' 
                                ? 'bg-linear-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400' 
                                : 'hover:bg-white/5 text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <LifeBuoy className="w-5 h-5" />
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveView('team')}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-105 ${
                                activeView === 'team'
                                    ? 'bg-linear-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400'
                                    : 'hover:bg-white/5 text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            <Shield className="w-5 h-5" />
                        </button>
                    )}
                    <button className="w-12 h-12 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-500 transition-all hover:text-slate-300">
                        <BarChart3 className="w-5 h-5" />
                    </button>
                    <button className="w-12 h-12 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-500 transition-all hover:text-slate-300">
                        <FileText className="w-5 h-5" />
                    </button>
                    <button className="w-12 h-12 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-500 transition-all hover:text-slate-300">
                        <Settings className="w-5 h-5" />
                    </button>
                </nav>

                {/* Bottom Icons */}
                <div className="flex flex-col items-center gap-2">
                    <button className="w-12 h-12 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-500 transition-all hover:text-slate-300">
                        <HelpCircle className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleLogout}
                        className="w-12 h-12 rounded-xl hover:bg-red-500/10 flex items-center justify-center text-slate-500 transition-all hover:text-red-400"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-20 flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Header - Sticky */}
                <header className="h-20 flex items-center justify-between px-8 border-b border-white/5 bg-[#0a1628]/60 backdrop-blur-xl sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">
                            {activeView === 'dashboard' ? 'Dashboard' : activeView === 'clients' ? 'Clientes' : activeView === 'team' ? 'Equipe' : 'Suporte'}
                        </h1>
                    </div>

                    {/* Search Bar */}
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder={activeView === 'support' ? 'Buscar chamado, cliente...' : 'Buscar cliente, CNPJ...'}
                            className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl py-3 pl-11 pr-20 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-600 bg-white/5 px-2 py-1 rounded-md">alt+f</span>
                    </div>

                    {/* Header Right */}
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 transition-all">
                            <FileText className="w-5 h-5" />
                        </button>
                        <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 transition-all relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full border-2 border-[#0a1628]"></span>
                        </button>
                        <div className="flex items-center gap-3 ml-2">
                            <div className="w-10 h-10 rounded-full bg-linear-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/20">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="hidden lg:block">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-white">{user?.name || 'Usuário'}</p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                        isAdmin ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/20 text-purple-300'
                                    }`}>
                                        {isAdmin ? 'Admin' : 'Colab'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500">{user?.accountingName || user?.email || ''}</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-8">
                    {activeView === 'team' && isAdmin ? (
                        /* TEAM VIEW */
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-3xl font-bold text-white">Gestão de Equipe</h2>
                                    <p className="text-slate-400">Gerencie os colaboradores do escritório</p>
                                </div>
                                <button
                                    onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
                                    className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
                                >
                                    <UserPlus className="w-5 h-5" />
                                    Novo Colaborador
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5">
                                    <p className="text-slate-400 text-sm">Total</p>
                                    <p className="text-3xl font-bold text-white mt-2">{teamMembers.length}</p>
                                </div>
                                <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5">
                                    <p className="text-slate-400 text-sm">Administradores</p>
                                    <p className="text-3xl font-bold text-white mt-2">{teamMembers.filter(m => m.role === 'admin').length}</p>
                                </div>
                                <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5">
                                    <p className="text-slate-400 text-sm">Colaboradores</p>
                                    <p className="text-3xl font-bold text-white mt-2">{teamMembers.filter(m => m.role === 'collaborator').length}</p>
                                </div>
                            </div>

                            {/* Team List */}
                            <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="text-white font-semibold">Membros da equipe</h3>
                                    <span className="text-xs text-slate-500">{teamMembers.length} membros</span>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {isTeamLoading ? (
                                        <div className="p-6 space-y-3">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : teamMembers.length > 0 ? (
                                        teamMembers.map((member) => (
                                            <div key={member.id} className="px-6 py-5 hover:bg-white/5 transition-all group">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                                            member.role === 'admin'
                                                                ? 'bg-linear-to-br from-cyan-400 to-blue-600'
                                                                : 'bg-linear-to-br from-purple-400 to-pink-600'
                                                        }`}>
                                                            {member.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-white font-semibold">{member.name}</span>
                                                                {member.id === user?.id && (
                                                                    <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Você</span>
                                                                )}
                                                            </div>
                                                            <p className="text-slate-500 text-sm">{member.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-xs px-2 py-1 rounded-md border ${
                                                            member.role === 'admin'
                                                                ? 'border-cyan-400/40 text-cyan-300 bg-cyan-500/10'
                                                                : 'border-purple-400/40 text-purple-300 bg-purple-500/10'
                                                        }`}>
                                                            {member.role === 'admin' ? 'Admin' : 'Colaborador'}
                                                        </span>
                                                        <span className={`text-xs px-2 py-1 rounded-md border ${
                                                            member.status === 'active'
                                                                ? 'border-green-400/40 text-green-300 bg-green-500/10'
                                                                : 'border-slate-500/40 text-slate-300 bg-slate-500/10'
                                                        }`}>
                                                            {member.status === 'active' ? 'Ativo' : member.status === 'invited' ? 'Convidado' : 'Inativo'}
                                                        </span>
                                                        <button
                                                            onClick={() => { setEditingUser(member); setIsUserModalOpen(true); }}
                                                            className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-cyan-400 transition-all opacity-0 group-hover:opacity-100"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        {member.id !== user?.id && (
                                                            <button
                                                                onClick={() => handleDeleteUser(member.id)}
                                                                className="p-2 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                                                title="Remover"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-10 text-center text-slate-400">
                                            <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                            <p>Nenhum colaborador cadastrado</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : activeView === 'clients' ? (
                        /* CLIENTS VIEW */
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-3xl font-bold text-white">Lista de Clientes</h2>
                                    <p className="text-slate-400">Gerencie todos os seus clientes</p>
                                </div>
                                <button 
                                    onClick={() => setIsModalOpen(true)}
                                    className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
                                >
                                    <Plus className="w-5 h-5" />
                                    Novo Cliente
                                </button>
                            </div>

                            {/* Client Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {isLoading ? (
                                    [1, 2, 3, 4, 5, 6].map(i => (
                                        <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse"></div>
                                    ))
                                ) : filteredClients.length > 0 ? (
                                    filteredClients.map((client) => (
                                        <div 
                                            key={client.id}
                                            onClick={() => navigate(`/client/${client.id}`)}
                                            className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center text-cyan-400 mb-4 shadow-inner">
                                                    <Building2 className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors">{client.name}</h3>
                                                    <p className="text-slate-500 text-sm">{client.industry || 'Sem categoria'}</p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={(e) => handleEditClient(e, client)}
                                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-cyan-400 transition-all opacity-0 group-hover:opacity-100"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                                    <Briefcase className="w-4 h-4" />
                                                    <span>CNPJ: {client.cnpj}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${
                                                        client.status === 'active' 
                                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                                    }`}>
                                                        {client.status === 'active' ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                    
                                                    <button 
                                                        onClick={(e) => handleToggleStatus(e, client)}
                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                            client.status === 'active' ? 'bg-cyan-600' : 'bg-slate-700'
                                                        }`}
                                                    >
                                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                                            client.status === 'active' ? 'translate-x-5' : 'translate-x-1'
                                                        }`} />
                                                    </button>
                                                </div>
                                                <span className="text-cyan-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-medium">
                                                    Acessar <ChevronRight className="w-4 h-4" />
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-16 bg-[#0d1829]/50 rounded-2xl border border-white/5">
                                        <Building2 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-400 text-lg mb-4">Nenhum cliente cadastrado</p>
                                        <button 
                                            onClick={() => setIsModalOpen(true)}
                                            className="bg-linear-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:opacity-90 transition-all"
                                        >
                                            Adicionar Primeiro Cliente
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeView === 'support' ? (
                        /* SUPPORT VIEW */
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold text-white">Chamados de Suporte</h2>
                                    <p className="text-slate-400">Acompanhe e responda os pedidos dos seus clientes</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {(['open', 'in_progress', 'closed', 'all'] as const).map((filter) => (
                                        <button
                                            key={filter}
                                            onClick={() => setSupportFilter(filter)}
                                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                                                supportFilter === filter
                                                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                                            }`}
                                        >
                                            {filter === 'open'
                                                ? 'Abertos'
                                                : filter === 'in_progress'
                                                ? 'Em atendimento'
                                                : filter === 'closed'
                                                ? 'Resolvidos'
                                                : 'Todos'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { label: 'Abertos', value: supportTickets.filter(t => t.status === 'open').length },
                                    { label: 'Em atendimento', value: supportTickets.filter(t => t.status === 'in_progress').length },
                                    { label: 'Resolvidos', value: supportTickets.filter(t => t.status === 'closed').length },
                                ].map((stat, idx) => (
                                    <div key={idx} className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5">
                                        <p className="text-slate-400 text-sm">{stat.label}</p>
                                        <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="text-white font-semibold">Chamados recentes</h3>
                                    <span className="text-xs text-slate-500">{supportTickets.length} chamados</span>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {isSupportLoading ? (
                                        <div className="p-6 space-y-3">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : filteredTickets.length > 0 ? (
                                        filteredTickets.map((ticket) => (
                                            <div key={ticket.id} className="px-6 py-5 hover:bg-white/5 transition-all">
                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <span className="text-white font-semibold">{ticket.subject}</span>
                                                            <span className={`text-xs px-2 py-1 rounded-md border ${
                                                                ticket.priority === 'high'
                                                                    ? 'border-red-400/40 text-red-300 bg-red-500/10'
                                                                    : ticket.priority === 'medium'
                                                                    ? 'border-amber-400/40 text-amber-300 bg-amber-500/10'
                                                                    : 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'
                                                            }`}>
                                                                {ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Média' : 'Baixa'}
                                                            </span>
                                                            <span className={`text-xs px-2 py-1 rounded-md border ${
                                                                ticket.status === 'open'
                                                                    ? 'border-cyan-400/40 text-cyan-300 bg-cyan-500/10'
                                                                    : ticket.status === 'in_progress'
                                                                    ? 'border-purple-400/40 text-purple-300 bg-purple-500/10'
                                                                    : 'border-slate-500/40 text-slate-300 bg-slate-500/10'
                                                            }`}>
                                                                {ticket.status === 'open'
                                                                    ? 'Aberto'
                                                                    : ticket.status === 'in_progress'
                                                                    ? 'Em atendimento'
                                                                    : 'Resolvido'}
                                                            </span>
                                                        </div>
                                                        <p className="text-slate-400 text-sm line-clamp-2">{ticket.message}</p>
                                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                                            <span>{ticket.client.name}</span>
                                                            <span>•</span>
                                                            <span>CNPJ: {ticket.client.cnpj}</span>
                                                            <span>•</span>
                                                            <span>{new Date(ticket.created_at).toLocaleString('pt-BR')}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {ticket.status === 'open' && (
                                                            <button
                                                                onClick={() => supportService.updateStatus(ticket.id, 'in_progress').then(() => fetchSupportTickets(supportFilter === 'all' ? undefined : supportFilter))}
                                                                className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all"
                                                            >
                                                                Iniciar
                                                            </button>
                                                        )}
                                                        {ticket.status !== 'closed' && (
                                                            <button
                                                                onClick={() => supportService.updateStatus(ticket.id, 'closed').then(() => fetchSupportTickets(supportFilter === 'all' ? undefined : supportFilter))}
                                                                className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-all"
                                                            >
                                                                Resolver
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-10 text-center text-slate-400">
                                            Nenhum chamado encontrado.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* DASHBOARD VIEW */
                        <div className="flex gap-8 animate-in fade-in duration-300">
                            {/* Left Column */}
                            <div className="flex-1 space-y-6">
                                {/* Welcome Section */}
                                <div>
                                    <p className="text-slate-400 text-lg">{getGreeting()},</p>
                                    <h2 className="text-4xl font-bold text-white">{user?.name || 'Usuário'}</h2>
                                </div>

                            {/* Stats Row */}
                            <div className="flex gap-6">
                                {/* Storage/Usage Card */}
                                <div className="flex-1 bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-cyan-500/10 to-transparent rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                    
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-slate-400 text-sm">Clientes este mês</span>
                                        <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:outline-none">
                                            <option>Fevereiro</option>
                                            <option>Janeiro</option>
                                        </select>
                                    </div>
                                    
                                    <div className="text-5xl font-bold text-white mb-4">
                                        {totalClients} <span className="text-lg text-slate-400 font-normal">clientes</span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Capacidade</span>
                                            <span className="text-cyan-400">{50 - totalClients} vagas</span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-linear-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min((totalClients / 50) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tasks Cards Row */}
                            <div className="flex gap-6">
                                {/* Uploading Files / Pending Tasks */}
                                <div className="flex-1 bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white font-semibold">Pendências Recentes</h3>
                                        <button className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 transition-all">
                                            <span className="text-xs">×</span>
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {[
                                            { name: 'Declaração IR', client: 'Empresa ABC', progress: 100, done: true },
                                            { name: 'Balanço Mensal', client: 'XYZ Ltda', progress: 65, done: false },
                                            { name: 'DARF Pagamento', client: 'Tech Solutions', progress: 23, done: false },
                                        ].map((task, idx) => (
                                            <div key={idx} className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${task.done ? 'bg-green-500/20 text-green-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-white text-sm font-medium">{task.name}</span>
                                                        {task.done ? (
                                                            <span className="text-green-400 text-xs">✓</span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">{task.progress}%</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 text-xs">{task.client}</span>
                                                        <div className="flex-1 ml-4 h-1 bg-white/5 rounded-full overflow-hidden max-w-20">
                                                            <div 
                                                                className={`h-full rounded-full ${task.done ? 'bg-green-500' : 'bg-cyan-500'}`}
                                                                style={{ width: `${task.progress}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-white/5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-400 text-sm">Processando</span>
                                            <span className="text-cyan-400 font-semibold">73%</span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden mt-2">
                                            <div className="h-full bg-linear-to-r from-cyan-500 to-blue-600 rounded-full" style={{ width: '73%' }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Spaces / Categorias */}
                                <div className="flex-1 bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-white font-semibold">Categorias</h3>
                                            <p className="text-slate-500 text-xs mt-1">Organize seus clientes por categoria</p>
                                        </div>
                                        <button 
                                            onClick={() => setIsModalOpen(true)}
                                            className="flex items-center gap-1 bg-linear-to-r from-cyan-500 to-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-all"
                                        >
                                            Novo Cliente <Plus className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {/* Tab Buttons */}
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="flex bg-white/5 rounded-lg p-1">
                                            <button 
                                                onClick={() => setActiveTab('personal')}
                                                className={`px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'personal' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                Ativos
                                            </button>
                                            <button 
                                                onClick={() => setActiveTab('team')}
                                                className={`px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'team' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                Todos
                                            </button>
                                        </div>
                                    </div>

                                    {/* Category Cards */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-linear-to-br from-[#0d2847]/60 to-[#0a1f3a]/60 rounded-xl p-4 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer group">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                                                    <Briefcase className="w-5 h-5" />
                                                </div>
                                                <MoreVertical className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <h4 className="text-white font-medium mb-2">Empresas</h4>
                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                <span>{clients.filter(c => c.status === 'active').length} <span className="text-slate-600">ativos</span></span>
                                                <span>{pendingTasks} <span className="text-slate-600">tarefas</span></span>
                                            </div>
                                        </div>

                                        <div className="bg-linear-to-br from-[#0d2847]/60 to-[#0a1f3a]/60 rounded-xl p-4 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer group">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                                                    <Users className="w-5 h-5" />
                                                </div>
                                                <MoreVertical className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <h4 className="text-white font-medium mb-2">Autônomos</h4>
                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                <span>0 <span className="text-slate-600">ativos</span></span>
                                                <span>0 <span className="text-slate-600">tarefas</span></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Client List / Storage Access */}
                            <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-white font-semibold">Lista de Clientes</h3>
                                </div>
                                <p className="text-slate-500 text-sm mb-6">Gerencie seus clientes e acesse seus dashboards</p>

                                {/* Client List */}
                                <div className="space-y-3">
                                    {isLoading ? (
                                        <div className="space-y-3">
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse"></div>
                                            ))}
                                        </div>
                                    ) : filteredClients.length > 0 ? (
                                        filteredClients.slice(0, 5).map((client) => (
                                            <div 
                                                key={client.id}
                                                onClick={() => navigate(`/client/${client.id}`)}
                                                className="flex items-center justify-between p-4 bg-linear-to-r from-[#0d2847]/40 to-transparent rounded-xl border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center text-cyan-400">
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-white font-medium group-hover:text-cyan-400 transition-colors">{client.name}</h4>
                                                        <p className="text-slate-500 text-xs">CNPJ: {client.cnpj}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6">
                                                    <div className="text-right hidden sm:block">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                                                            client.status === 'active' 
                                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                                                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                                        }`}>
                                                            {client.status === 'active' ? 'Ativo' : 'Inativo'}
                                                        </span>
                                                    </div>

                                                    {/* Avatars Stack */}
                                                    <div className="flex -space-x-2 hidden md:flex">
                                                        <div className="w-7 h-7 rounded-full bg-linear-to-br from-cyan-400 to-blue-600 border-2 border-[#0d1829] flex items-center justify-center text-white text-xs font-bold">
                                                            {client.name.charAt(0)}
                                                        </div>
                                                    </div>

                                                    <button className="flex items-center gap-1 bg-linear-to-r from-cyan-500 to-blue-600 text-white text-xs px-4 py-2 rounded-lg hover:opacity-90 transition-all opacity-0 group-hover:opacity-100">
                                                        Acessar
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12">
                                            <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                            <p className="text-slate-500">Nenhum cliente encontrado</p>
                                            <button 
                                                onClick={() => setIsModalOpen(true)}
                                                className="mt-4 bg-linear-to-r from-cyan-500 to-blue-600 text-white text-sm px-6 py-2 rounded-lg hover:opacity-90 transition-all"
                                            >
                                                Adicionar Cliente
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {filteredClients.length > 5 && (
                                    <div className="mt-4 text-center">
                                        <button className="text-cyan-400 text-sm hover:underline">
                                            Ver todos os {filteredClients.length} clientes
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Sidebar - Team Structure */}
                        <div className="w-72 hidden xl:block">
                            <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5 sticky top-8">
                                <h3 className="text-white font-semibold mb-6">Equipe do Escritório</h3>

                                <div className="space-y-4">
                                    {teamMembers.length > 0 ? teamMembers.slice(0, 6).map((member) => (
                                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group">
                                            <div className={`w-10 h-10 rounded-full bg-linear-to-br ${
                                                member.role === 'admin' ? 'from-cyan-400 to-blue-600' : 'from-purple-400 to-pink-600'
                                            } flex items-center justify-center text-white font-bold text-sm`}>
                                                {member.name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white text-sm font-medium group-hover:text-cyan-400 transition-colors">{member.name}</p>
                                                <p className="text-slate-500 text-xs">{member.role === 'admin' ? 'Administrador' : 'Colaborador'}</p>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-slate-500 text-sm">Carregando equipe...</p>
                                    )}
                                </div>

                                {isAdmin && (
                                    <button
                                        onClick={() => setActiveView('team')}
                                        className="w-full mt-6 flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-slate-400 text-sm py-3 rounded-xl hover:bg-white/10 hover:text-white transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Gerenciar Equipe
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </main>

            <ClientRegistrationModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onSuccess={fetchClients}
                client={editingClient}
            />

            <UserModal
                isOpen={isUserModalOpen}
                onClose={() => { setIsUserModalOpen(false); setEditingUser(null); }}
                onSuccess={fetchTeamMembers}
                user={editingUser}
            />
        </div>
    );
};

export default Dashboard;
