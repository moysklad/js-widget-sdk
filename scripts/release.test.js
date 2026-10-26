/** @jest-environment node */

const childProcess = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { validateReleaseVersion, isVersionPublished } = require('./release.cjs');

describe('release versions', () => {
  let packageJson;
  let packageLock;

  beforeEach(() => {
    packageJson = { version: '1.3.0' };
    packageLock = { version: '1.3.0', packages: { '': { version: '1.3.0' } } };
  });

  test('selects latest for matching package, lockfile and stable tag versions', () => {
    expect(validateReleaseVersion('v1.3.0', packageJson, packageLock)).toEqual({
      version: '1.3.0',
      npmTag: 'latest',
      prerelease: false
    });
  });

  test.each(['1.4.0-rc.0', '1.4.0-rc.1', '1.4.0-rc.12'])(
    'selects the rc channel and a GitHub prerelease for %s',
    (version) => {
      packageJson.version = version;
      packageLock.version = version;
      packageLock.packages[''].version = version;

      expect(
        validateReleaseVersion(`v${version}`, packageJson, packageLock)
      ).toEqual({ version, npmTag: 'rc', prerelease: true });
    }
  );

  test('requires an exact match of the RC number', () => {
    packageJson.version = '1.4.0-rc.1';
    packageLock.version = '1.4.0-rc.1';
    packageLock.packages[''].version = '1.4.0-rc.1';

    expect(() =>
      validateReleaseVersion('v1.4.0-rc.0', packageJson, packageLock)
    ).toThrow('package.json (1.4.0-rc.1)');
  });

  test.each([
    undefined,
    '1.3.0',
    'v1.3',
    'v01.3.0',
    'v1.03.0',
    'v1.3.00',
    'v1.3.0-alpha.1',
    'v1.3.0-beta.1',
    'v1.3.0+build.1',
    'v1.3.0-rc',
    'v1.3.0-rc.',
    'v1.3.0-rc.-1',
    'v1.3.0-rc.01',
    'v1.3.0-rc.1.2',
    'v1.3.0-RC.1',
    'v1.3.0-rc.1+build.1'
  ])('rejects unsupported release tag %s', (tag) => {
    expect(() => validateReleaseVersion(tag, packageJson, packageLock)).toThrow(
      'Expected a release tag'
    );
  });

  test('rejects a different package.json version', () => {
    packageJson.version = '1.2.0';
    expect(() =>
      validateReleaseVersion('v1.3.0', packageJson, packageLock)
    ).toThrow('package.json (1.2.0)');
  });

  test('rejects a different top-level lockfile version', () => {
    packageLock.version = '1.2.0';
    expect(() =>
      validateReleaseVersion('v1.3.0', packageJson, packageLock)
    ).toThrow('package-lock.json version (1.2.0)');
  });

  test('rejects a different root-package lockfile version', () => {
    packageLock.packages[''].version = '1.2.0';
    expect(() =>
      validateReleaseVersion('v1.3.0', packageJson, packageLock)
    ).toThrow('packages[""].version (1.2.0)');
  });

  test('rejects a missing root-package lockfile version', () => {
    delete packageLock.packages;
    expect(() =>
      validateReleaseVersion('v1.3.0', packageJson, packageLock)
    ).toThrow('packages[""].version (undefined)');
  });
});

describe('npm publication status', () => {
  let npm;

  beforeEach(() => {
    npm = jest.spyOn(childProcess, 'spawnSync');
  });

  afterEach(() => {
    npm.mockRestore();
  });

  test.each(['1.3.0', '1.4.0-rc.0'])(
    'skips an existing exact version %s',
    (version) => {
      npm.mockReturnValue({
        status: 0,
        stdout: JSON.stringify(version),
        stderr: ''
      });
      expect(isVersionPublished('@moysklad/js-widget-sdk', version)).toBe(true);
    }
  );

  test('allows publishing only when npm reports E404', () => {
    npm.mockReturnValue({
      status: 1,
      stdout: JSON.stringify({ error: { code: 'E404' } }),
      stderr: 'npm error code E404'
    });
    expect(isVersionPublished('@moysklad/js-widget-sdk', '1.3.0')).toBe(false);
  });

  test.each(['E500', 'E401', 'E403', 'ETIMEDOUT', 'ENOTFOUND'])(
    'stops the release on Registry error %s',
    (code) => {
      npm.mockReturnValue({
        status: 1,
        stdout: JSON.stringify({ error: { code } }),
        stderr: `npm error code ${code}`
      });
      expect(() =>
        isVersionPublished('@moysklad/js-widget-sdk', '1.3.0')
      ).toThrow(`npm Registry lookup failed: ${code}`);
    }
  );

  test('stops when npm cannot start', () => {
    npm.mockReturnValue({ error: new Error('spawn npm ENOENT') });
    expect(() =>
      isVersionPublished('@moysklad/js-widget-sdk', '1.3.0')
    ).toThrow('spawn npm ENOENT');
  });

  test('stops when the Registry lookup times out', () => {
    npm.mockReturnValue({ error: new Error('spawnSync npm ETIMEDOUT') });
    expect(() =>
      isVersionPublished('@moysklad/js-widget-sdk', '1.3.0')
    ).toThrow('npm Registry lookup failed: spawnSync npm ETIMEDOUT');
  });

  test.each(['null', '[]', '{}'])(
    'does not interpret an incomplete error response %s as a missing version',
    (stdout) => {
      npm.mockReturnValue({ status: 1, stdout, stderr: '' });
      expect(() =>
        isVersionPublished('@moysklad/js-widget-sdk', '1.3.0')
      ).toThrow('npm Registry lookup failed: exit code 1');
    }
  );

  test('stops on an invalid Registry response', () => {
    npm.mockReturnValue({ status: 1, stdout: '', stderr: 'connection reset' });
    expect(() =>
      isVersionPublished('@moysklad/js-widget-sdk', '1.3.0')
    ).toThrow('Could not read npm Registry response: connection reset');
  });

  test('stops if the Registry returns a different version', () => {
    npm.mockReturnValue({ status: 0, stdout: '"1.2.0"', stderr: '' });
    expect(() =>
      isVersionPublished('@moysklad/js-widget-sdk', '1.3.0')
    ).toThrow('Unexpected npm version');
  });
});

describe('release validation CLI', () => {
  let directory;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'sdk-release-test-'));
    writeVersions('1.3.0');
  });

  function writeVersions(version) {
    writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ version })
    );
    writeFileSync(
      path.join(directory, 'package-lock.json'),
      JSON.stringify({
        version,
        packages: { '': { version } }
      })
    );
  }

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function validate(tag) {
    return childProcess.spawnSync(
      process.execPath,
      [path.join(__dirname, 'release.cjs'), 'validate', tag],
      { cwd: directory, encoding: 'utf8' }
    );
  }

  test('validates a release before installing dependencies', () => {
    const result = validate('v1.3.0');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      'version=1.3.0\nnpm_tag=latest\nprerelease=false\n'
    );
    expect(result.stderr).toBe('');
  });

  test.each(['1.4.0-rc.0', '1.4.0-rc.1'])(
    'outputs the rc publication settings for %s',
    (version) => {
      writeVersions(version);
      const result = validate(`v${version}`);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(
        `version=${version}\nnpm_tag=rc\nprerelease=true\n`
      );
      expect(result.stderr).toBe('');
    }
  );

  test('returns a failure exit code for an unsupported prerelease tag', () => {
    const result = validate('v1.3.0-beta.1');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Expected a release tag');
  });

  test('returns a failure exit code for a mismatched lockfile', () => {
    writeFileSync(
      path.join(directory, 'package-lock.json'),
      JSON.stringify({
        version: '1.3.0',
        packages: { '': { version: '1.2.0' } }
      })
    );
    const result = validate('v1.3.0');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('packages[""].version (1.2.0)');
  });
});
