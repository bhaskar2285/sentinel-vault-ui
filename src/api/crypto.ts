import { api } from './client';

export const cryptoApi = {
  decrypt: (body: {
    keyId: string;
    ciphertextHex: string;
    mode?: string;
    iv?: string;
    inputFormat?: string;
    outputFormat?: string;
  }) => api.post('/crypto/decrypt', body).then((r) => r.data),

  encrypt: (body: {
    keyId: string;
    plaintextHex: string;
    mode?: string;
    iv?: string;
    keyType?: string;
  }) => api.post('/crypto/encrypt', body).then((r) => r.data),
};
