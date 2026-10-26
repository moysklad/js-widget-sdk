const { readFileSync } = require('node:fs');
const childProcess = require('node:child_process');

const REGISTRY = 'https://registry.npmjs.org';

function validateReleaseVersion(tag, packageJson, packageLock) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    throw new Error(`Expected a stable release tag vX.Y.Z, received: ${tag}`);
  }

  const version = tag.slice(1);
  const versions = {
    'package.json': packageJson.version,
    'package-lock.json version': packageLock.version,
    'package-lock.json packages[""].version':
      packageLock.packages?.['']?.version
  };

  for (const [source, actual] of Object.entries(versions)) {
    if (actual !== version) {
      throw new Error(
        `Tag version (${version}) does not match ${source} (${actual})`
      );
    }
  }

  return version;
}

function isVersionPublished(name, version) {
  const result = childProcess.spawnSync(
    'npm',
    [
      'view',
      `${name}@${version}`,
      'version',
      '--json',
      `--registry=${REGISTRY}`,
      '--fetch-retries=1',
      '--fetch-timeout=15000'
    ],
    { encoding: 'utf8', timeout: 60000 }
  );

  if (result.error) {
    throw new Error(`npm Registry lookup failed: ${result.error.message}`);
  }

  let response;
  try {
    response = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Could not read npm Registry response: ${result.stderr || result.stdout}`
    );
  }

  if (result.status !== 0) {
    if (response?.error?.code === 'E404') {
      return false;
    }
    throw new Error(
      `npm Registry lookup failed: ${response?.error?.code || result.stderr || `exit code ${result.status}`}`
    );
  }

  if (response !== version) {
    throw new Error(`Unexpected npm version: ${JSON.stringify(response)}`);
  }

  return true;
}

if (require.main === module) {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const command = process.argv[2];

    if (command === 'validate') {
      const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
      console.log(
        validateReleaseVersion(process.argv[3], packageJson, packageLock)
      );
    } else if (command === 'published') {
      console.log(isVersionPublished(packageJson.name, packageJson.version));
    } else {
      console.error(
        'Usage: node scripts/release.cjs validate <tag> | published'
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateReleaseVersion, isVersionPublished };
