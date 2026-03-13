declare module 'puppeteer-stream' {
    import { Page, Browser } from 'puppeteer';
    import { EventEmitter } from 'events';

    export interface StreamOptions {
        audio?: boolean;
        video?: boolean;
        videoConstraints?: {
            width?: { min?: number; ideal?: number; max?: number };
            height?: { min?: number; ideal?: number; max?: number };
            frameRate?: { min?: number; ideal?: number; max?: number };
        };
    }

    export interface Stream extends EventEmitter {
        destroy(): void;
        on(event: 'close', listener: () => void): this;
        on(event: 'error', listener: (error: Error) => void): this;
    }

    export function launch(options?: any): Promise<Browser>;
    export function getStream(page: Page, options?: StreamOptions): Promise<Stream>;
} 