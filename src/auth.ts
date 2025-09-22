import { CredentialsMissedError } from './errors';

export interface Credentials {
  apiKey: string;
  apiSecret: string;
}

export function fetchCredentials(): Credentials {
  const apiKey = process.env.HF_API_KEY;
  const apiSecret = process.env.HF_API_SECRET;

  if (apiKey && apiSecret) {
    return { apiKey, apiSecret };
  }

  throw new CredentialsMissedError();
}