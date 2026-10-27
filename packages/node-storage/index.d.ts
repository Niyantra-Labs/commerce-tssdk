import type { CachedOfflineCertificate, OfflineCertificateStorage } from '@niyantra/commerce';

export class FileOfflineCertificateStorage implements OfflineCertificateStorage {
  constructor(directory: string);
  get(key: string): Promise<CachedOfflineCertificate | undefined>;
  set(key: string, value: CachedOfflineCertificate): Promise<void>;
  delete(key: string): Promise<void>;
}
