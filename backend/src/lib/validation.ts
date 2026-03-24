import { AppError } from './http';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

export const toTrimmedString = (value: unknown) =>
    isNonEmptyString(value) ? value.trim() : '';

export const toOptionalTrimmedString = (value: unknown) =>
    isNonEmptyString(value) ? value.trim() : null;

export const normalizeEmail = (value: unknown) => toTrimmedString(value).toLowerCase();

export const normalizeDigits = (value: string) => value.replace(/\D/g, '');

export const assertValidEmail = (email: string, fieldLabel = 'Email') => {
    if (!EMAIL_PATTERN.test(email)) {
        throw new AppError(400, `${fieldLabel} inválido`);
    }
};

export const assertMinimumLength = (
    value: string,
    minimumLength: number,
    message: string
) => {
    if (value.length < minimumLength) {
        throw new AppError(400, message);
    }
};

export const parseRequiredYear = (value: unknown, fieldLabel = 'Ano') => {
    const parsed = Number.parseInt(String(value ?? ''), 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new AppError(400, `${fieldLabel} inválido`);
    }

    return parsed;
};

export const assertOneOf = <T extends string>(
    value: string,
    allowedValues: readonly T[],
    message: string
): T => {
    if (!allowedValues.includes(value as T)) {
        throw new AppError(400, message);
    }

    return value as T;
};
