import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export interface AccountOption {
    id: string;
    code: string;
    name: string;
    reducedCode?: string | null;
    accountType?: string | null;
}

interface Props {
    options: AccountOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    selectedLabel?: string;
}

const normalizeSearch = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const SearchableAccountSelectComponent: React.FC<Props> = ({
    options,
    value,
    onChange,
    placeholder = 'Selecione uma conta...',
    className = '',
    selectedLabel,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(
        () => (selectedLabel ? null : options.find((option) => option.id === value)),
        [options, selectedLabel, value]
    );

    const filteredOptions = useMemo(() => {
        if (!open) return [];
        if (!search.trim()) return options;

        const normalizedQuery = normalizeSearch(search);
        return options.filter((option) =>
            option.code.toLowerCase().includes(normalizedQuery) ||
            normalizeSearch(option.name).includes(normalizedQuery) ||
            (option.reducedCode && option.reducedCode.includes(normalizedQuery))
        );
    }, [open, options, search]);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };

        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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

    const displayText =
        selectedLabel ||
        (selectedOption
            ? `${selectedOption.code}${selectedOption.reducedCode ? ` - ${selectedOption.reducedCode}` : ''} - ${selectedOption.name}`
            : placeholder);

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#0d1829] px-4 py-3 text-left text-sm text-white outline-none transition-colors hover:border-white/20"
            >
                <span className="flex-1 truncate">{displayText}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/15 bg-[#0a1628] shadow-2xl shadow-black/60">
                    <div className="border-b border-white/10 p-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar por codigo ou nome..."
                                className="w-full rounded-lg border border-white/10 bg-[#0d1829] py-2.5 pl-9 pr-8 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-500/40"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-white/30">
                                Nenhuma conta encontrada
                            </div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected = option.id === value;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => handleSelect(option)}
                                        className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                                            isSelected
                                                ? 'bg-cyan-500/15 text-cyan-300'
                                                : 'text-white/70 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        <span className="min-w-[120px] shrink-0 font-mono text-xs text-white/45">
                                            {option.code}
                                        </span>
                                        {option.reducedCode && (
                                            <span className="shrink-0 font-mono text-xs text-white/25">
                                                {option.reducedCode}
                                            </span>
                                        )}
                                        {option.accountType && (
                                            <span
                                                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                                    option.accountType === 'A'
                                                        ? 'bg-cyan-500/15 text-cyan-400'
                                                        : 'bg-amber-500/15 text-amber-400'
                                                }`}
                                            >
                                                {option.accountType === 'A' ? 'A' : 'T'}
                                            </span>
                                        )}
                                        <span className="truncate">{option.name}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className="border-t border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/30">
                        {filteredOptions.length} de {options.length} contas
                    </div>
                </div>
            )}
        </div>
    );
};

export const SearchableAccountSelect = memo(SearchableAccountSelectComponent);
SearchableAccountSelect.displayName = 'SearchableAccountSelect';

export default SearchableAccountSelect;
