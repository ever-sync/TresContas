import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    clientDocumentService,
    type ClientDocument,
} from '../services/clientDocumentService';

const formatFileSize = (sizeBytes: number) => {
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const [, base64 = ''] = result.split(',');
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

export const ClientDocumentUploadPanel = () => {
    const [documents, setDocuments] = useState<ClientDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [category, setCategory] = useState('');

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const data = await clientDocumentService.listForClient();
            setDocuments(data);
        } catch (error) {
            console.error('Erro ao carregar arquivos do cliente:', error);
            toast.error('Erro ao carregar arquivos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!file || !displayName.trim() || !category.trim()) {
            toast.error('Preencha nome, categoria e selecione um arquivo');
            return;
        }

        try {
            setSubmitting(true);
            const contentBase64 = await toBase64(file);
            await clientDocumentService.uploadForClient({
                original_name: file.name,
                display_name: displayName.trim(),
                category: category.trim(),
                mime_type: file.type || 'application/octet-stream',
                content_base64: contentBase64,
            });

            toast.success('Arquivo enviado com sucesso');
            setFile(null);
            setDisplayName('');
            setCategory('');
            await loadDocuments();
        } catch (error: any) {
            console.error('Erro ao enviar arquivo:', error);
            toast.error(error?.response?.data?.message || 'Erro ao enviar arquivo');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
            <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                <div className="mb-6">
                    <h3 className="text-2xl font-bold text-white tracking-tight">Enviar Arquivos</h3>
                    <p className="text-white/40 text-sm">Anexe documentos para a contabilidade, defina um nome e categorize o envio.</p>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-white/60">Nome do arquivo no sistema</label>
                        <input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Ex: Extrato Banco Itau Janeiro"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-white/60">Categoria</label>
                        <input
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Ex: Extrato bancario, Nota fiscal, Contrato"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-4 py-3 rounded-2xl cursor-pointer hover:bg-white/10 transition-all">
                            <Upload className="w-4 h-4" />
                            {file ? 'Trocar arquivo' : 'Selecionar arquivo'}
                            <input
                                type="file"
                                className="hidden"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 disabled:opacity-50 text-white px-5 py-3 rounded-2xl transition-all font-bold"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Enviar
                        </button>
                    </div>
                </form>

                {file && (
                    <div className="mt-4 text-sm text-white/50">
                        Selecionado: <span className="text-white/80">{file.name}</span> • {formatFileSize(file.size)}
                    </div>
                )}
            </div>

            <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h4 className="text-white font-semibold">Arquivos enviados</h4>
                    <span className="text-xs text-slate-500">{documents.length} arquivo(s)</span>
                </div>

                {loading ? (
                    <div className="p-10 flex items-center justify-center gap-3 text-white/40">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Carregando arquivos...
                    </div>
                ) : documents.length === 0 ? (
                    <div className="p-16 text-center">
                        <FileText className="w-16 h-16 text-white/10 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-white/40 mb-2">Nenhum arquivo enviado</h4>
                        <p className="text-sm text-white/20">Os arquivos enviados aqui ficam disponíveis para a contabilidade.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {documents.map((document) => (
                            <div key={document.id} className="px-6 py-5 flex flex-wrap items-center justify-between gap-4 hover:bg-white/5 transition-all">
                                <div>
                                    <h5 className="text-white font-semibold">{document.display_name}</h5>
                                    <p className="text-sm text-white/40 mt-1">{document.category} • {document.original_name}</p>
                                    <p className="text-xs text-white/25 mt-1">
                                        {new Date(document.created_at).toLocaleString('pt-BR')} • {formatFileSize(document.size_bytes)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => clientDocumentService.downloadForClient(document.id, document.original_name)}
                                    className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    <Download className="w-4 h-4" />
                                    Baixar
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientDocumentUploadPanel;
