import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DiskUploadsStorageDriver,
  StorageInvalidPathError,
  StoragePermissionError,
} from './uploads-storage.service';

describe('DiskUploadsStorageDriver', () => {
  let tmpRoot: string;
  let driver: DiskUploadsStorageDriver;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-uploads-test-'));
    driver = new DiskUploadsStorageDriver(tmpRoot);
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('rejects path traversal and root-prefix escape attempts', () => {
    expect(() => driver.resolvePath('../etc/passwd')).toThrow(StorageInvalidPathError);
    expect(() => driver.resolvePath('installation-records/../../secret')).toThrow(
      StorageInvalidPathError,
    );
    expect(() => driver.resolvePath('')).toThrow(StorageInvalidPathError);
  });

  it('writes, checks existence, reads buffer, and streams valid relative paths', () => {
    const rel = 'installation-records/2026/SN-1/photos/test.jpg';
    const payload = Buffer.from('hello-image-bytes');

    driver.writeBuffer(rel, payload);

    expect(driver.exists(rel)).toBe(true);
    expect(driver.readBuffer(rel).equals(payload)).toBe(true);
    expect(driver.resolvePath(rel).startsWith(fs.realpathSync(tmpRoot))).toBe(true);
  });

  it('wraps EACCES errors into StoragePermissionError', () => {
    const eacces = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw eacces;
    });

    expect(() =>
      driver.writeBuffer('installation-records/2026/SN-1/zapisnik/REC-1.pdf', Buffer.from('pdf')),
    ).toThrow(StoragePermissionError);
  });

  it('computes sha256 and moves a temporary file into the target uploads path', async () => {
    const srcFile = path.join(tmpRoot, 'incoming.apk');
    fs.writeFileSync(srcFile, Buffer.from('apk-binary-content'));

    const result = await driver.moveLocalFile(srcFile, 'app-releases/android/1_test.apk');

    expect(result.sha256).toHaveLength(64);
    expect(fs.existsSync(srcFile)).toBe(false);
    expect(driver.exists('app-releases/android/1_test.apk')).toBe(true);
  });
});
