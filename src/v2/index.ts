import { createHiggsfieldClient, configure as configureClient, V2ClientConfig } from './client';

// Create client instance
export const higgsfield = createHiggsfieldClient(undefined);

// Configuration function similar to fal.ai SDK
export function config(config: V2ClientConfig): void {
  // Browser check is done in configureClient
  configureClient(config);
}

// Export types and configure function
export { configureClient as configure, V2ClientConfig, createHiggsfieldClient };

// Re-export types and helpers
export * from '../types';
export * from '../errors';
export * from '../helpers';
export * from './types';  // Export v2-specific types including V2Response

