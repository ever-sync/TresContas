declare module 'formidable' {
    import type { IncomingMessage } from 'http';

    export interface File {
        filepath: string;
        originalFilename?: string | null;
        newFilename?: string | null;
        mimetype?: string | null;
    }

    export interface Fields {
        [key: string]: string | string[] | undefined;
    }

    export interface Files {
        [key: string]: File | File[] | undefined;
    }

    export interface FormidableOptions {
        multiples?: boolean;
        maxFileSize?: number;
        keepExtensions?: boolean;
        allowEmptyFiles?: boolean;
    }

    export interface FormidableInstance {
        parse: (req: IncomingMessage) => Promise<[Fields, Files]>;
    }

    export default function formidable(options?: FormidableOptions): FormidableInstance;
}
