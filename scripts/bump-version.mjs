#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(__dirname, '..');

const VALID_BUMPS = new Set(['patch', 'minor', 'major']);
const VALID_TARGETS = new Set(['mobile', 'frontend', 'backend', 'shared', 'all']);

export function parseSemver(raw) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(raw ?? '').trim());
  if (!match) {
    throw new Error(`Neispravna SemVer verzija: "${raw}" (očekivano X.Y.Z)`);
  }
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

export function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

export function incrementSemver(currentVersion, bumpOrExact) {
  if (VALID_BUMPS.has(bumpOrExact)) {
    const parsed = parseSemver(currentVersion);
    if (bumpOrExact === 'major') {
      return formatSemver({ major: parsed.major + 1, minor: 0, patch: 0 });
    }
    if (bumpOrExact === 'minor') {
      return formatSemver({ major: parsed.major, minor: parsed.minor + 1, patch: 0 });
    }
    return formatSemver({
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch + 1,
    });
  }
  return formatSemver(parseSemver(bumpOrExact));
}

export function parseCliArgs(argv) {
  const args = [...argv];
  if (args.includes('--help') || args.includes('-h')) {
    return { command: 'help' };
  }

  let command = 'bump';
  let bump = null;
  let target = 'mobile';
  let dryRun = false;
  let createTag = false;
  let bumpVersionCode = true;
  let explicitVersionCode = null;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === 'status') {
      command = 'status';
      continue;
    }
    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (token === '--tag') {
      createTag = true;
      continue;
    }
    if (token === '--no-code-bump') {
      bumpVersionCode = false;
      continue;
    }
    if (token.startsWith('--target=')) {
      target = token.slice('--target='.length);
      continue;
    }
    if (token === '--target') {
      target = args[++i] ?? '';
      continue;
    }
    if (token.startsWith('--version-code=')) {
      explicitVersionCode = Number.parseInt(token.slice('--version-code='.length), 10);
      continue;
    }
    if (token === '--version-code') {
      explicitVersionCode = Number.parseInt(args[++i] ?? '', 10);
      continue;
    }
    if (token.startsWith('-')) {
      throw new Error(`Nepoznata opcija: ${token}`);
    }
    if (!bump) {
      bump = token;
    } else {
      throw new Error(`Neočekivani argument: ${token}`);
    }
  }

  if (!VALID_TARGETS.has(target)) {
    throw new Error(
      `Neispravan --target="${target}". Dozvoljeno: mobile, frontend, backend, shared, all`,
    );
  }

  if (explicitVersionCode !== null && (!Number.isInteger(explicitVersionCode) || explicitVersionCode < 1)) {
    throw new Error(`Neispravan --version-code (mora biti pozitivan cijeli broj)`);
  }

  if (command === 'bump' && !bump) {
    throw new Error(
      'Nedostaje tip promjene verzije: navedi patch | minor | major | X.Y.Z ili "status".',
    );
  }

  return {
    command,
    bump,
    target,
    dryRun,
    createTag,
    bumpVersionCode,
    explicitVersionCode,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function getVersionStatus(rootDir = DEFAULT_ROOT) {
  const mobileAppJson = readJson(path.join(rootDir, 'mobile/app.json'));
  const mobilePkg = readJson(path.join(rootDir, 'mobile/package.json'));
  const frontendPkg = readJson(path.join(rootDir, 'frontend/package.json'));
  const backendPkg = readJson(path.join(rootDir, 'backend/package.json'));
  const sharedPkg = readJson(path.join(rootDir, 'packages/shared/package.json'));

  return {
    mobile: {
      version: mobileAppJson.expo?.version ?? mobilePkg.version,
      packageVersion: mobilePkg.version,
      androidVersionCode: mobileAppJson.expo?.android?.versionCode ?? null,
    },
    frontend: { version: frontendPkg.version },
    backend: { version: backendPkg.version },
    shared: { version: sharedPkg.version },
  };
}

export function applyVersionBump(options, rootDir = DEFAULT_ROOT) {
  const targets =
    options.target === 'all'
      ? ['mobile', 'frontend', 'backend', 'shared']
      : [options.target];

  const changes = [];

  if (targets.includes('mobile')) {
    const appJsonPath = path.join(rootDir, 'mobile/app.json');
    const pkgPath = path.join(rootDir, 'mobile/package.json');
    const appJson = readJson(appJsonPath);
    const pkg = readJson(pkgPath);

    const prevVersion = appJson.expo?.version ?? pkg.version;
    const nextVersion = incrementSemver(prevVersion, options.bump);
    const prevCode = Number(appJson.expo?.android?.versionCode ?? 0);
    const nextCode =
      options.explicitVersionCode !== null
        ? options.explicitVersionCode
        : options.bumpVersionCode
          ? prevCode + 1
          : prevCode;

    if (!options.dryRun) {
      appJson.expo = appJson.expo ?? {};
      appJson.expo.version = nextVersion;
      appJson.expo.android = appJson.expo.android ?? {};
      appJson.expo.android.versionCode = nextCode;
      pkg.version = nextVersion;
      writeJson(appJsonPath, appJson);
      writeJson(pkgPath, pkg);
    }

    changes.push({
      target: 'mobile',
      prevVersion,
      nextVersion,
      prevVersionCode: prevCode,
      nextVersionCode: nextCode,
      tagName: `mobile-v${nextVersion}+b${nextCode}`,
    });
  }

  for (const pkgTarget of ['frontend', 'backend', 'shared']) {
    if (!targets.includes(pkgTarget)) continue;
    const relPath =
      pkgTarget === 'shared'
        ? 'packages/shared/package.json'
        : `${pkgTarget}/package.json`;
    const pkgPath = path.join(rootDir, relPath);
    const pkg = readJson(pkgPath);
    const prevVersion = pkg.version;
    const nextVersion = incrementSemver(prevVersion, options.bump);

    if (!options.dryRun) {
      pkg.version = nextVersion;
      writeJson(pkgPath, pkg);
    }

    changes.push({
      target: pkgTarget,
      prevVersion,
      nextVersion,
      tagName: `${pkgTarget}-v${nextVersion}`,
    });
  }

  return changes;
}

function printHelp() {
  console.log(`SIM Tracker — upravljanje verzijama (SemVer + Android versionCode)

Upotreba:
  node scripts/bump-version.mjs status
  node scripts/bump-version.mjs <patch|minor|major|X.Y.Z> [opcije]

Opcije:
  --target=<mobile|frontend|backend|shared|all>  Ciljni paket (podrazumijevano: mobile)
  --version-code=<N>                             Eksplicitni Android versionCode
  --no-code-bump                                 Ne uvećavaj android.versionCode za +1
  --tag                                          Kreiraj anotirani git tag za novu verziju
  --dry-run                                      Prikaži promjene bez izmjene fajlova
  -h, --help                                     Prikaži ovu pomoć

Primjeri:
  npm run version:status
  npm run version:bump -- patch
  npm run version:bump -- minor --target=mobile
  npm run version:bump -- patch --target=all --dry-run
`);
}

function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.command === 'help') {
    printHelp();
    return;
  }

  if (opts.command === 'status') {
    const status = getVersionStatus(DEFAULT_ROOT);
    console.log('Trenutne verzije u monorepu:');
    console.log(
      `  mobile:   ${status.mobile.version} (android versionCode: ${status.mobile.androidVersionCode ?? 'nije postavljen'}, package.json: ${status.mobile.packageVersion})`,
    );
    console.log(`  frontend: ${status.frontend.version}`);
    console.log(`  backend:  ${status.backend.version}`);
    console.log(`  shared:   ${status.shared.version}`);
    return;
  }

  const changes = applyVersionBump(opts, DEFAULT_ROOT);
  const prefix = opts.dryRun ? '[DRY-RUN] ' : '';
  for (const ch of changes) {
    if (ch.target === 'mobile') {
      console.log(
        `${prefix}mobile: ${ch.prevVersion} (b${ch.prevVersionCode}) -> ${ch.nextVersion} (b${ch.nextVersionCode})`,
      );
    } else {
      console.log(`${prefix}${ch.target}: ${ch.prevVersion} -> ${ch.nextVersion}`);
    }
  }

  if (opts.createTag) {
    const tagName =
      opts.target === 'all'
        ? `v${changes[0].nextVersion}`
        : changes[0].tagName;
    if (opts.dryRun) {
      console.log(`${prefix}git tag -a ${tagName} -m "Release ${tagName}"`);
    } else {
      execFileSync('git', ['tag', '-a', tagName, '-m', `Release ${tagName}`], {
        cwd: DEFAULT_ROOT,
        stdio: 'inherit',
      });
      console.log(`Kreiran git tag: ${tagName}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (err) {
    console.error(`Greška: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
