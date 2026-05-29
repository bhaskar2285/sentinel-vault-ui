import { api } from './client';

export interface KeySummary {
  keyId: string;
  label: string;
  keyType: string;
  algo: string;
  keyLengthBits: number;
  status: string;
  kcv?: string;
  bankRecId?: number;
  branchRecId?: number;
  createdAt: string;
  /** P3 — populated by gateway after DTO patch */
  encryptedBlobHex?: string;
  encryptedBlobLen?: number;
  vendorOrigin?: string;
  expiresAt?: string;
}

export const keysApi = {
  list: (params: { label?: string; keyType?: string } = {}) =>
    api.get<KeySummary[]>('/keys', { params }).then((r) => r.data),

  get: (id: string) => api.get(`/keys/${id}`).then((r) => r.data),

  generateRsa: (body: {
    label: string;
    modulusBits: number;
    keyType?: string;
    encoding?: string;
    publicExponentHex?: string;
    usage?: string;
    ownerOrg?: string;
  }) => api.post('/keys/rsa', body).then((r) => r.data),

  generateSymmetric: (body: {
    label: string;
    keyType?: string;
    keyScheme?: string;
    mode?: string;
    zmkKeyId?: string;
    outScheme?: string;
    usage?: string;
    ownerOrg?: string;
  }) => api.post('/keys/symmetric', body).then((r) => r.data),

  importRsaWrapped: (body: {
    label: string;
    wrappingPublicKey: string;
    wrappedKey: string;
    mode?: string;
    hashId?: string;
    keyType?: string;
    usage?: string;
  }) => api.post('/keys/import-rsa-wrapped', body).then((r) => r.data),

  exportKey: (
    id: string,
    body: {
      format: 'TR31_B' | 'TR31_D' | 'X9_143' | 'RAW';
      kbpkKeyId?: string;
      kekType?: string;
      schemeZmk?: string;
      schemeLmk?: string;
      keyType?: number;
      usage2?: string;
      algo1?: string;
      mode1?: string;
      export1?: string;
    }
  ) => api.post(`/keys/${id}/export`, body).then((r) => r.data),
};
