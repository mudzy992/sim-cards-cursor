import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class StorageInvalidPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageInvalidPathError';
  }
}

export class StoragePermissionError extends Error {
  readonly code: string;
  readonly targetPath: string;

  constructor(code: string, targetPath: string, message: string) {
    super(message);
    this.name = 'StoragePermissionError';
    this.code = code;
    this.targetPath = targetPath;
  }
}

export interface UploadsStorageDriver {
  resolvePath(relativePath: string): string;
  exists(relativePath: string): boolean;
  readBuffer(relativePath: string): Buffer;
  createReadStream(relativePath: string): fs.ReadStream;
  writeBuffer(relativePath: string, data: Buffer): void;
  moveLocalFile(sourcePath: string, targetRelativePath: string): Promise<{ sha256: string }>;
  removeDirRecursive(relativeDir: string): void;
  removeFileIfExists(relativePath: string): void;
}

const PERMISSION_ERRNO_CODES = new Set(['EACCES', 'EPERM', 'EROFS']);

export function isStoragePermissionError(error: unknown): boolean {
  if (error instanceof StoragePermissionError) {
    return true;
  }
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return Boolean(code && PERMISSION_ERRNO_CODES.has(code));
}

export class DiskUploadsStorageDriver implements UploadsStorageDriver {
  private readonly logger = new Logger(DiskUploadsStorageDriver.name);
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  resolvePath(relativePath: string): string {
    if (!relativePath || typeof relativePath !== 'string') {
      throw new StorageInvalidPathError('Missing relative storage path');
    }
    const normalized = relativePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .trim();

    if (!normalized || normalized.includes('\0')) {
      throw new StorageInvalidPathError('Invalid relative storage path');
    }

    const segments = normalized.split('/');
    if (segments.some((seg) => seg === '..' || seg === '.')) {
      throw new StorageInvalidPathError('Path traversal segments are not allowed');
    }

    const resolved = path.resolve(this.rootDir, normalized);
    const rootWithSep = this.rootDir.endsWith(path.sep)
      ? this.rootDir
      : `${this.rootDir}${path.sep}`;

    if (resolved !== this.rootDir && !resolved.startsWith(rootWithSep)) {
      throw new StorageInvalidPathError('Resolved path escapes uploads root');
    }

    return resolved;
  }

  exists(relativePath: string): boolean {
    const resolved = this.resolvePath(relativePath);
    return fs.existsSync(resolved);
  }

  readBuffer(relativePath: string): Buffer {
    const resolved = this.resolvePath(relativePath);
    return fs.readFileSync(resolved);
  }

  createReadStream(relativePath: string): fs.ReadStream {
    const resolved = this.resolvePath(relativePath);
    return fs.createReadStream(resolved);
  }

  writeBuffer(relativePath: string, data: Buffer): void {
    const resolved = this.resolvePath(relativePath);
    const dir = path.dirname(resolved);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(resolved, data);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code && PERMISSION_ERRNO_CODES.has(code)) {
        const uid = process.getuid?.();
        const gid = process.getgid?.();
        const msg =
          `Cannot write file to "${resolved}" (${code}, uid=${uid}, gid=${gid}). ` +
          'Ensure the host uploads mount is writable by UID/GID 1000:1000 (chown -R 1000:1000 <host_uploads_dir>).';
        this.logger.error(msg);
        throw new StoragePermissionError(code, resolved, msg);
      }
      throw error;
    }
  }

  async moveLocalFile(
    sourcePath: string,
    targetRelativePath: string,
  ): Promise<{ sha256: string }> {
    const resolvedTarget = this.resolvePath(targetRelativePath);
    const targetDir = path.dirname(resolvedTarget);

    const sha256 = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(sourcePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      try {
        fs.renameSync(sourcePath, resolvedTarget);
      } catch (renameError) {
        const renameCode = (renameError as NodeJS.ErrnoException)?.code;
        if (renameCode && PERMISSION_ERRNO_CODES.has(renameCode)) {
          throw renameError;
        }
        fs.copyFileSync(sourcePath, resolvedTarget);
        fs.unlinkSync(sourcePath);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code && PERMISSION_ERRNO_CODES.has(code)) {
        const uid = process.getuid?.();
        const gid = process.getgid?.();
        const msg =
          `Cannot save file to "${resolvedTarget}" (${code}, uid=${uid}, gid=${gid}). ` +
            'Ensure the host uploads mount is writable by UID/GID 1000:1000 (chown -R 1000:1000 <host_uploads_dir>).';
        this.logger.error(msg);
        throw new StoragePermissionError(code, resolvedTarget, msg);
      }
      throw error;
    }

    return { sha256 };
  }

  removeDirRecursive(relativeDir: string): void {
    const resolved = this.resolvePath(relativeDir);
    if (resolved === this.rootDir || !fs.existsSync(resolved)) {
      return;
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }

  removeFileIfExists(relativePath: string): void {
    const resolved = this.resolvePath(relativePath);
    if (resolved === this.rootDir || !fs.existsSync(resolved)) {
      return;
    }
    if (fs.statSync(resolved).isFile()) {
      fs.unlinkSync(resolved);
    }
  }
}

@Injectable()
export class UploadsStorageService implements UploadsStorageDriver {
  private readonly driver: UploadsStorageDriver;

  constructor(@Optional() config?: ConfigService) {
    const root =
      config?.get<string>('UPLOAD_ROOT_PATH') ??
      process.env.UPLOAD_ROOT_PATH ??
      path.join(process.cwd(), 'uploads');
    this.driver = new DiskUploadsStorageDriver(root);
  }

  resolvePath(relativePath: string): string {
    return this.driver.resolvePath(relativePath);
  }

  exists(relativePath: string): boolean {
    return this.driver.exists(relativePath);
  }

  readBuffer(relativePath: string): Buffer {
    return this.driver.readBuffer(relativePath);
  }

  createReadStream(relativePath: string): fs.ReadStream {
    return this.driver.createReadStream(relativePath);
  }

  writeBuffer(relativePath: string, data: Buffer): void {
    this.driver.writeBuffer(relativePath, data);
  }

  moveLocalFile(sourcePath: string, targetRelativePath: string): Promise<{ sha256: string }> {
    return this.driver.moveLocalFile(sourcePath, targetRelativePath);
  }

  removeDirRecursive(relativeDir: string): void {
    this.driver.removeDirRecursive(relativeDir);
  }

  removeFileIfExists(relativePath: string): void {
    this.driver.removeFileIfExists(relativePath);
  }
}
