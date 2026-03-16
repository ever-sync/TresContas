import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    clientDocumentService,
    type StaffClientDocument,
} from '../services/clientDocumentService';

interface StaffClientDocumentsManagerProps {
    searchTerm?: string;
}

const formatFileSize = (sizeBytes: number) => {
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const StaffClientDocumentsManager = ({
    searchTerm = '',
}: StaffClientDocumentsManagerProps) => {
    const [documents, setDocuments] = useState<StaffClientDocument[]>([]);
    const [loading, setLoading] = useState(true);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const data = await clientDocumentService.listForStaff();
            setDocuments(data);
        } catch (error) {
            console.error('Erro ao carregar documentos dos clientes:', error);
            toast.error('Erro ao carregar documentos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const filteredDocuments = useMemo(() => {
        const normalizedSearch = searchTerm.toLowerCase();
        if (!normalizedSearch) return documents;
        return documents.filter((document) =>
            document.display_name.toLowerCase().includes(normalizedSearch) ||
            document.category.toLowerCase().includes(normalizedSearch) ||
            document.original_name.toLowerCase().includes(normalizedSearch) ||
            document.client.name.toLowerCase().includes(normalizedSearch) ||
            document.client.cnpj.includes(searchTerm)
        );
    }, [documents, searchTerm]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h2 className="text-3xl font-bold text-white">Arquivos dos Clientes</h2>
                <p className="text-slate-400">Baixe os documentos enviados pelos clientes no portal.</p>
            </div>

            <div className="bg-[#0d1829]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Arquivos anexados</h3>
                    <span className="text-xs text-slate-500">{filteredDocuments.length} arquivo(s)</span>
                </div>

                {loading ? (
                    <div className="p-10 flex items-center justify-center gap-3 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Carregando documentos...
                    </div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="p-16 text-center">
                        <FileText className="w-16 h-16 text-white/10 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-white/40 mb-2">Nenhum documento recebido</h4>
                        <p className="text-sm text-white/20">Quando um cliente enviar arquivos pelo portal, eles aparecerão aqui.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredDocuments.map((document) => (
                            <div key={document.id} className="px-6 py-5 flex flex-wrap items-center justify-between gap-4 hover:bg-white/5 transition-all">
                                <div>
                                    <h4 className="text-white font-semibold">{document.display_name}</h4>
                                    <p className="text-sm text-white/40 mt-1">{document.client.name} • {document.category}</p>
                                    <p className="text-xs text-white/25 mt-1">
                                        {document.original_name} • {new Date(document.created_at).toLocaleString('pt-BR')} • {formatFileSize(document.size_bytes)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => clientDocumentService.downloadForStaff(document.id, document.original_name)}
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

export default StaffClientDocumentsManager;
