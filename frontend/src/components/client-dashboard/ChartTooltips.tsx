import React from 'react';

type TooltipEntry = {
    name?: string;
    value?: number | string;
    color?: string;
    fill?: string;
    stroke?: string;
};

type ChartTooltipProps = {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
};

const containerStyle: React.CSSProperties = {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '10px 14px',
    minWidth: '180px',
};

export const TooltipCurrency = ({ active, payload, label }: ChartTooltipProps) => {
    if (!active || !payload?.length) return null;

    return (
        <div style={containerStyle}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>
                {label}
            </p>
            {payload.map((entry, index) => (
                <div
                    key={`${entry.name || 'serie'}-${index}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: index < payload.length - 1 ? '5px' : 0 }}
                >
                    <div
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: entry.color ?? entry.fill,
                            flexShrink: 0,
                        }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}>{entry.name}</span>
                    <span style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold', marginLeft: 'auto', paddingLeft: '12px' }}>
                        R$ {Number(entry.value ?? 0).toLocaleString('pt-BR')}
                    </span>
                </div>
            ))}
        </div>
    );
};

export const TooltipPercent = ({ active, payload, label }: ChartTooltipProps) => {
    if (!active || !payload?.length) return null;

    return (
        <div style={containerStyle}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>
                {label}
            </p>
            {payload.map((entry, index) => (
                <div
                    key={`${entry.name || 'serie'}-${index}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: index < payload.length - 1 ? '5px' : 0 }}
                >
                    <div
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: entry.color ?? entry.stroke,
                            flexShrink: 0,
                        }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}>{entry.name}</span>
                    <span style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold', marginLeft: 'auto', paddingLeft: '12px' }}>
                        {Number(entry.value ?? 0).toFixed(1)}%
                    </span>
                </div>
            ))}
        </div>
    );
};
