/**
 * Cast Kit - Client SDK Entry Point
 * 
 * This is the entry point for the Cast Kit client SDK.
 */

// Export public client APIs
export { 
    createCastClient,
    type CastClient,
    type CastClientOptions
} from './core/client';

export {
    type CastState,
    type CastDevice,
    type CastSession,
    type CastSessionStatus,
    type CastError,
    type SignalReadyParams,
    type CastOptions
} from './core/types'; 