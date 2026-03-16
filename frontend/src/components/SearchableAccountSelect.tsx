import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export interface AccountOption {
    id: string;       // valor usado como value (id ou code)
    code: string;     // código hierárquico (01.1.01.01.0001)
    name: string;
    reducedCode?: string | null;
}

interface Props {
    options: AccountOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const normalizeSearch = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const SearchableAccountSelect: React.FC<Props> = ({
    options,
    value,
    onChange,
    placeholder = 'Selecione uma conta...',
    className = '',
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(
        () => options.find((o) => o.id === value),
        [options, value]
    );

    const filtered = useMemo(() => {
        if (!search.trim()) return options;
        const q = normalizeSearch(search);
        return options.filter(
            (o) =>
                o.code.toLowerCase().includes(q) ||
                normalizeSearch(o.name).includes(q) ||
                (o.reducedCode && o.reducedCode.includes(q))
        );
    }, [options, search]);

    // Close on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Focus input when opening
    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    const handleSelect = (option: AccountOption) => {
        onChange(option.id);
        setOpen(false);
        setSearch('');
    };

    const displayText = selectedOption
        ? `${selectedOption.code}${selectedOption.reducedCode ? ` • ${selectedOption.reducedCode}` : ''} • ${selectedOption.name}`
        : placeholder;

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full rounded-xl bg-[#0d1829] border border-white/10 text-white text-sm px-4 py-3 text-left flex items-center gap-2 outline-none hover:border-white/20 transition-colors"
            >
                <span className="flex-1 truncate">{displayText}</span>
                <ChevronDown className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl bg-[#0a1628] border border-white/15 shadow-2xl shadow-black/60 overflow-hidden">
                    {/* Search input */}
                    <div className="p-2 border-b border-white/10">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por código ou nome..."
                                className="w-full bg-[#0d1829] border border-white/10 rounded-lg text-white text-sm pl-9 pr-8 py-2.5 outline-none placeholder:text-white/25 focus:border-cyan-500/40"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options list */}
                    <div ref={listRef} className="max-h-60 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-white/30">
                                Nenhuma conta encontrada
                            </div>
                        ) : (
                            filtered.map((option) => {
                                const isSelected = option.id === value;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => handleSelect(option)}
                                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                                            isSelected
                                                ? 'bg-cyan-500/15 text-cyan-300'
                                                : 'text-white/70 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        <span className="font-mono text-xs text-white/45 shrink-0 min-w-[120px]">
                                            {option.code}
                                        </span>
                                        {option.reducedCode && (
                                            <span className="font-mono text-xs text-white/25 shrink-0">
                                                {option.reducedCode}
                                            </span>
                                        )}
                                        <span className="truncate">{option.name}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer count */}
                    <div className="px-4 py-2 border-t border-white/10 text-[10px] text-white/30 font-bold uppercase tracking-wider">
                        {filtered.length} de {options.length} contas
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableAccountSelect;
