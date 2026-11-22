import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  applyVersionBump,
  getVersionStatus,
  incrementSemver,
  parseCliArgs,
  parseSemver,
} from './bump-version.mjs';

describe('bump-version', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-version-test-'));
    fs.mkdirSync(path.join(tmpDir, 'mobile'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'frontend'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'backend'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'packages/shared'), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, 'mobile/app.json'),
      JSON.stringify({
        expo: {
          version: '1.2.3',
          android: { package: 'ba.epbih.simtracker', versionCode: 40 },
        },
      }),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'mobile/package.json'),
      JSON.stringify({ name: 'sim-tracker-mobile', version: '1.2.3' }),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'frontend/package.json'),
      JSON.stringify({ name: 'sim-tracker-frontend', version: '2.2.44' }),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'backend/package.json'),
      JSON.stringify({ name: 'sim-tracker-backend', version: '0.1.0' }),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'packages/shared/package.json'),
      JSON.stringify({ name: '@sim-tracker/shared', version: '0.1.0' }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses and increments SemVer for patch, minor, major and explicit versions', () => {
    assert.deepEqual(parseSemver('1.2.3'), { major: 1, minor: 2, patch: 3 });
    assert.equal(incrementSemver('1.2.3', 'patch'), '1.2.4');
    assert.equal(incrementSemver('1.2.3', 'minor'), '1.3.0');
    assert.equal(incrementSemver('1.2.3', 'major'), '2.0.0');
    assert.equal(incrementSemver('1.2.3', '3.0.1'), '3.0.1');
    assert.throws(() => parseSemver('1.2'), /Neispravna SemVer verzija/);
  });

  it('parses CLI flags accurately', () => {
    assert.deepEqual(parseCliArgs(['status']), {
      command: 'status',
      bump: null,
      target: 'mobile',
      dryRun: false,
      createTag: false,
      bumpVersionCode: true,
      explicitVersionCode: null,
    });
    assert.deepEqual(
      parseCliArgs(['minor', '--target=all', '--dry-run', '--version-code=55']),
      {
        command: 'bump',
        bump: 'minor',
        target: 'all',
        dryRun: true,
        createTag: false,
        bumpVersionCode: true,
        explicitVersionCode: 55,
      },
    );
    assert.throws(() => parseCliArgs(['patch', '--target=unknown']), /Neispravan --target/);
    assert.throws(() => parseCliArgs([]), /Nedostaje tip promjene verzije/);
  });

  it('bumps mobile version and android.versionCode while preserving dry-run isolation', () => {
    const dryOpts = parseCliArgs(['minor', '--target=mobile', '--dry-run']);
    const dryResult = applyVersionBump(dryOpts, tmpDir);
    assert.equal(dryResult[0].nextVersion, '1.3.0');
    assert.equal(dryResult[0].nextVersionCode, 41);
    assert.equal(getVersionStatus(tmpDir).mobile.version, '1.2.3');
    assert.equal(getVersionStatus(tmpDir).mobile.androidVersionCode, 40);

    const realOpts = parseCliArgs(['minor', '--target=mobile']);
    applyVersionBump(realOpts, tmpDir);
    const after = getVersionStatus(tmpDir);
    assert.equal(after.mobile.version, '1.3.0');
    assert.equal(after.mobile.packageVersion, '1.3.0');
    assert.equal(after.mobile.androidVersionCode, 41);
    assert.equal(after.frontend.version, '2.2.44');
  });

  it('bumps all targets when --target=all is provided', () => {
    const opts = parseCliArgs(['patch', '--target=all', '--no-code-bump']);
    applyVersionBump(opts, tmpDir);
    const status = getVersionStatus(tmpDir);
    assert.equal(status.mobile.version, '1.2.4');
    assert.equal(status.mobile.androidVersionCode, 40);
    assert.equal(status.frontend.version, '2.2.45');
    assert.equal(status.backend.version, '0.1.1');
    assert.equal(status.shared.version, '0.1.1');
  });
});
