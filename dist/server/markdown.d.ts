export declare const header: (level: number, text: string) => string;
export declare const bold: (label: string, value: string) => string;
export declare const list: (items: string[], bullet?: string) => string;
export declare const blankLine: () => string;
export declare const paragraph: (text: string) => string;
export declare const section: (title: string, body: string[]) => string[];
export declare const trimWithEllipsis: (text: string, maxLength: number) => string;
export declare const codeBlock: (code: string, language?: string) => string;
export declare const inlineCode: (code: string) => string;
export declare const warning: (message: string) => string;
export declare const deprecationWarning: (platform: string, message?: string) => string;
export declare const availabilityBadge: (platform: string, version: string, options?: {
    deprecated?: boolean;
    beta?: boolean;
    unavailable?: boolean;
}) => string;
