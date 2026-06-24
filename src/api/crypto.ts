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

  // MAC — Thales M6/M7 (generate) and M8/M9 (verify). CBC-MAC under a stored key.
  macGenerate: (body: {
    keyId: string;
    dataHex: string;
    mode?: string;
    inputFormat?: string;
    algorithm?: string;
    padding?: string;
    iv?: string;
  }) => api.post('/crypto/mac/generate', body).then((r) => r.data),

  macVerify: (body: {
    keyId: string;
    dataHex: string;
    mac: string;
    mode?: string;
    inputFormat?: string;
    algorithm?: string;
    padding?: string;
    iv?: string;
  }) => api.post('/crypto/mac/verify', body).then((r) => r.data),

  // HMAC — Thales LQ/LR (generate) and LS/LT (verify). Keyed-hash MAC (SPA2 AAV).
  hmacGenerate: (body: {
    keyId: string;
    dataHex: string;
    hashId?: string;
    hmacLen?: string;
  }) => api.post('/crypto/hmac/generate', body).then((r) => r.data),

  hmacVerify: (body: {
    keyId: string;
    dataHex: string;
    hmac: string;
    hashId?: string;
  }) => api.post('/crypto/hmac/verify', body).then((r) => r.data),
};
