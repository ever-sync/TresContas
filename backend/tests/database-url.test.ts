import { describe, expect, it } from 'vitest';
import { normalizeDatabaseConnectionString } from '../src/lib/databaseUrl';

describe('normalizeDatabaseConnectionString', () => {
    it('removes ssl parameters when ssl verification is disabled', () => {
        const result = normalizeDatabaseConnectionString(
            'postgresql://user:pass@localhost:5432/trescontas?sslmode=require&ssl=true&application_name=app',
            'insecure'
        );

        expect(result).toBe('postgresql://user:pass@localhost:5432/trescontas?application_name=app');
    });

    it('keeps ssl parameters in strict mode', () => {
        const result = normalizeDatabaseConnectionString(
            'postgresql://user:pass@localhost:5432/trescontas?sslmode=require&application_name=app',
            'strict'
        );

        expect(result).toContain('sslmode=require');
        expect(result).toContain('application_name=app');
    });
});
