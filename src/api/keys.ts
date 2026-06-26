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
  // bankScope: a recId scopes to that bank (+ global keys); 'ALL' returns every
  // bank (admin) by omitting X-Bank-Id; omitted = use the session's active bank.
  list: (params: { label?: string; keyType?: string; bankScope?: number | 'ALL' } = {}) => {
    const { bankScope, ...query } = params;
    const cfg: Record<string, unknown> = { params: query };
    if (bankScope === 'ALL') cfg.bankScope = 'all';
    else if (typeof bankScope === 'number') cfg.bankScope = bankScope;
    return api.get<KeySummary[]>('/keys', cfg).then((r) => r.data);
  },

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

/** Key-component ceremony (Thales A2/A4 + BU). Components are LMK-encrypted (host-secure). */
export const componentsApi = {
  // A2 — HSM generates a random component encrypted under LMK (plaintext is printed at the HSM).
  generate: (body: { scheme?: string; keyType?: string }) =>
    api.post<{ errCode: string; scheme: string; component: string; kcv?: string }>(
      '/crypto/key/component/generate', body,
    ).then((r) => r.data),

  // BU — KCV of a raw (unstored) LMK-encrypted component.
  checkValueRaw: (body: { keyHex: string; scheme: string; keyType?: string }) =>
    api.post<{ errCode: string; kcv?: string }>('/crypto/key/check-value', body).then((r) => r.data),

  // A4 — XOR the encrypted components into one key under the LMK; persists when label is set.
  form: (body: { keyType: string; scheme: string; components: string[]; label?: string; usage?: string }) =>
    api.post<{ errCode: string; scheme: string; keyUnderLmk: string; kcv: string; keyId?: string }>(
      '/crypto/key/form-from-components', body,
    ).then((r) => r.data),
};
