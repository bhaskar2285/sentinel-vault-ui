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

// Luna (PKCS#11) — ZMK->DEK custodian ceremony + data crypto. Separate from the Thales path.
export const lunaApi = {
  // Form a ZMK token object from the XOR of clear custodian components.
  formZmk: (body: { components: string[]; algorithm?: string; label: string }) =>
    api.post<{ keyId?: string; kcv?: string; errCode: string; errText?: string }>(
      '/luna/zmk/form', body,
    ).then((r) => r.data),

  // Register a DEK delivered already wrapped under the ZMK (unwrapped inside the HSM to validate).
  importDek: (body: { zmkKeyId: string; dekBlob: string; wrapMech?: string; algorithm?: string; label: string }) =>
    api.post<{ keyId?: string; kcv?: string; errCode: string; errText?: string }>(
      '/luna/dek/import', body,
    ).then((r) => r.data),

  encrypt: (body: { keyId: string; data: string; transformation?: string; iv?: string }) =>
    api.post<{ ciphertext?: string; iv?: string; errCode: string; errText?: string }>(
      '/luna/data/encrypt', body,
    ).then((r) => r.data),

  decrypt: (body: { keyId: string; data: string; transformation?: string; iv?: string }) =>
    api.post<{ plaintext?: string; errCode: string; errText?: string }>(
      '/luna/data/decrypt', body,
    ).then((r) => r.data),

  // Generate a Key Block Protection Key (version D = AES, B = 3DES).
  generateKbpk: (body: { version: string; keyBits: number; label: string }) =>
    api.post<{ keyId?: string; kcv?: string; errCode: string; errText?: string }>(
      '/luna/kbpk/generate', body,
    ).then((r) => r.data),

  // Wrap a clear working key into a TR-31 key block under a KBPK (always stored in the vault).
  tr31Wrap: (body: {
    kbpkKeyId: string; workingKeyHex: string; keyAlgorithm?: string; label?: string;
    keyUsage?: string; modeOfUse?: string; exportability?: string;
  }) =>
    api.post<{ tr31Block?: string; header?: string; version?: string; keyId?: string; errCode: string; errText?: string }>(
      '/luna/tr31/wrap', body,
    ).then((r) => r.data),

  // Unwrap (and authenticate) a TR-31 key block under a KBPK.
  tr31Unwrap: (body: { kbpkKeyId: string; tr31Block: string }) =>
    api.post<{ workingKeyHex?: string; header?: string; version?: string; errCode: string; errText?: string }>(
      '/luna/tr31/unwrap', body,
    ).then((r) => r.data),

  // Stored TR-31 key blocks (for unwrap / crypto dropdowns).
  listTr31Blocks: () =>
    api.get<Array<{
      keyId: string; label: string; tr31Block: string; header: string; version: string;
      keyAlgorithm: string; keyBits: number; kbpkKeyId: string; kbpkLabel: string; createdAt?: string;
    }>>('/luna/tr31/blocks').then((r) => r.data),

  // KCV of a clear key value (e.g. a ZMK custodian component).
  kcv: (body: { valueHex: string; algorithm?: string }) =>
    api.post<{ kcv?: string; errCode: string; errText?: string }>(
      '/luna/kcv', body,
    ).then((r) => r.data),

  // Luna-native export: TR-31-wrap a stored Luna key under a transport KBPK (replaces A8/A9).
  exportKey: (body: { keyId: string; transportKbpkId: string; keyUsage?: string }) =>
    api.post<{ tr31Block?: string; keyId?: string; version?: string; errCode: string; errText?: string }>(
      '/luna/export', body,
    ).then((r) => r.data),
};
