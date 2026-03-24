import type { CookieOptions, Request, Response } from 'express';
import { securityConfig } from '../config/security';

export type AuthAudience = 'staff' | 'client';

export const AUTH_COOKIE_NAMES = {
    staffAccess: 'tc_staff_at',
    staffRefresh: 'tc_staff_rt',
    clientAccess: 'tc_client_at',
    clientRefresh: 'tc_client_rt',
} as const;

const getCookieNamePair = (audience: AuthAudience) =>
    audience === 'staff'
        ? {
            access: AUTH_COOKIE_NAMES.staffAccess,
            refresh: AUTH_COOKIE_NAMES.staffRefresh,
        }
        : {
            access: AUTH_COOKIE_NAMES.clientAccess,
            refresh: AUTH_COOKIE_NAMES.clientRefresh,
        };

export const parseCookieHeader = (cookieHeader: string | undefined) =>
    String(cookieHeader || '')
        .split(';')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .reduce<Record<string, string>>((cookies, chunk) => {
            const separatorIndex = chunk.indexOf('=');
            if (separatorIndex < 0) {
                return cookies;
            }

            const name = decodeURIComponent(chunk.slice(0, separatorIndex).trim());
            const value = decodeURIComponent(chunk.slice(separatorIndex + 1).trim());
            cookies[name] = value;
            return cookies;
        }, {});

export const getRequestCookies = (req: Request) => {
    const parsedCookies = parseCookieHeader(req.headers.cookie);
    const requestCookies = (req as Request & { cookies?: Record<string, string> }).cookies;

    return {
        ...parsedCookies,
        ...(requestCookies && typeof requestCookies === 'object' ? requestCookies : {}),
    };
};

export const getRequestCookie = (req: Request, cookieName: string) => getRequestCookies(req)[cookieName] || null;

export const getBearerToken = (req: Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return null;

    return token;
};

export const getAccessTokenForAudience = (req: Request, audience: AuthAudience) => {
    const { access } = getCookieNamePair(audience);
    return getRequestCookie(req, access) || getBearerToken(req);
};

export const getRefreshTokenForAudience = (req: Request, audience: AuthAudience) => {
    const { refresh } = getCookieNamePair(audience);
    return getRequestCookie(req, refresh);
};

const buildCookieOptions = (maxAgeMs: number): CookieOptions => ({
    httpOnly: true,
    secure: securityConfig.authCookieSecure,
    sameSite: securityConfig.authCookieSameSite,
    domain: securityConfig.authCookieDomain,
    path: '/api',
    maxAge: maxAgeMs,
});

const buildClearCookieOptions = (): CookieOptions => ({
    httpOnly: true,
    secure: securityConfig.authCookieSecure,
    sameSite: securityConfig.authCookieSameSite,
    domain: securityConfig.authCookieDomain,
    path: '/api',
});

export const setAuthCookies = (
    res: Response,
    audience: AuthAudience,
    accessToken: string,
    refreshToken: string
) => {
    const { access, refresh } = getCookieNamePair(audience);

    res.cookie(access, accessToken, buildCookieOptions(securityConfig.authAccessTtlMs));
    res.cookie(refresh, refreshToken, buildCookieOptions(securityConfig.authRefreshTtlMs));
};

export const clearAuthCookies = (res: Response, audience: AuthAudience) => {
    const { access, refresh } = getCookieNamePair(audience);

    res.clearCookie(access, buildClearCookieOptions());
    res.clearCookie(refresh, buildClearCookieOptions());
};

export const getAuthCookieNames = (audience: AuthAudience) => getCookieNamePair(audience);
