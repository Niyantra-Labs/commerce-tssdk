import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Node-only storage for signed certificates. Use a private directory. */
export class FileOfflineCertificateStorage {
  constructor(directory) {
    this.directory = directory;
  }

  path(key) {
    const digest = createHash('sha256').update(key).digest('hex');
    return join(this.directory, `${digest}.json`);
  }

  async get(key) {
    let value;
    try {
      value = JSON.parse(await readFile(this.path(key), 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT' || error instanceof SyntaxError) return undefined;
      throw error;
    }
    if (typeof value?.certificate !== 'string' || typeof value?.signature !== 'string')
      return undefined;
    return { certificate: value.certificate, signature: value.signature };
  }

  async set(key, value) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = join(this.directory, `.${randomBytes(16).toString('hex')}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
      await rename(temporary, this.path(key));
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async delete(key) {
    await rm(this.path(key), { force: true });
  }
}
