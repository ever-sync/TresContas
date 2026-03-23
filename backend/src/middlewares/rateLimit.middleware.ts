import rateLimit from 'express-rate-limit';

const buildLimiter = (windowMs: number, max: number, message: string) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message },
    });

export const registerRateLimiter = buildLimiter(
    60 * 60 * 1000,
    5,
    'Muitas tentativas de cadastro. Tente novamente mais tarde.'
);

export const loginRateLimiter = buildLimiter(
    15 * 60 * 1000,
    10,
    'Muitas tentativas de login. Tente novamente em alguns minutos.'
);

export const clientLoginRateLimiter = buildLimiter(
    15 * 60 * 1000,
    10,
    'Muitas tentativas de login. Tente novamente em alguns minutos.'
);

export const aiAnalysisRateLimiter = buildLimiter(
    15 * 60 * 1000,
    20,
    'Muitas solicitações de análise. Tente novamente em alguns minutos.'
);
