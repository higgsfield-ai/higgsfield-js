import { CredentialsMissedError } from './errors';

export interface Credentials {
  apiKey: string;
  apiSecret: string;
}

export function fetchCredentials(): Credentials {
  // Check for single credentials field (v2 format: "KEY_ID:KEY_SECRET")
  const credentials = process.env.HF_CREDENTIALS || process.env.HF_KEY;
  if (credentials) {
    const parts = credentials.split(':');
    if (parts.length === 2) {
      return {
        apiKey: parts[0],
        apiSecret: parts[1]
      };
    }
  }

  // Fall back to separate environment variables (v1 format)
  const apiKey = process.env.HF_API_KEY;
  const apiSecret = process.env.HF_API_SECRET;

  if (apiKey && apiSecret) {
    return { apiKey, apiSecret };
  }

  throw new CredentialsMissedError();
}