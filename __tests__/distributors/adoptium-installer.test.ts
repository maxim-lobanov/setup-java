import { HttpClient } from '@actions/http-client';

import {
  AdoptiumDistribution,
  AdoptiumImplementation
} from '../../src/distributions/adoptium/installer';
import { JavaInstallerOptions } from '../../src/distributions/base-models';

let manifestData = require('../data/adoptium.json') as [];

describe('getAvailableVersions', () => {
  let spyHttpClient: jest.SpyInstance;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: []
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      { version: '16', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptiumImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      { version: '16', architecture: 'x86', packageType: 'jdk', checkLatest: false },
      AdoptiumImplementation.Hotspot,
      'os=mac&architecture=x86&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      { version: '16', architecture: 'x64', packageType: 'jre', checkLatest: false },
      AdoptiumImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jre&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      { version: '16-ea', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptiumImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jdk&release_type=ea&jvm_impl=hotspot&page_size=20&page=0'
    ]
  ])(
    'build correct url for %s',
    async (
      installerOptions: JavaInstallerOptions,
      impl: AdoptiumImplementation,
      expectedParameters
    ) => {
      const distribution = new AdoptiumDistribution(installerOptions, impl);
      const baseUrl = 'https://api.adoptium.net/v3/assets/version/%5B1.0,100.0%5D';
      const expectedUrl = `${baseUrl}?project=jdk&vendor=adoptium&heap_size=normal&sort_method=DEFAULT&sort_order=DESC&${expectedParameters}`;
      distribution['getPlatformOption'] = () => 'mac';

      await distribution['getAvailableVersions']();

      expect(spyHttpClient.mock.calls).toHaveLength(1);
      expect(spyHttpClient.mock.calls[0][0]).toBe(expectedUrl);
    }
  );

  it('load available versions', async () => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: []
      });

    const distribution = new AdoptiumDistribution(
      { version: '8', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptiumImplementation.Hotspot
    );
    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();
    expect(availableVersions.length).toBe(manifestData.length * 2);
  });

  it.each([
    [AdoptiumImplementation.Hotspot, 'jdk', 'Java_Adoptium-Hotspot_jdk'],
    [AdoptiumImplementation.Hotspot, 'jre', 'Java_Adoptium-Hotspot_jre']
  ])(
    'find right toolchain folder',
    (impl: AdoptiumImplementation, packageType: string, expected: string) => {
      const distribution = new AdoptiumDistribution(
        { version: '8', architecture: 'x64', packageType: packageType, checkLatest: false },
        impl
      );

      // @ts-ignore - because it is protected
      expect(distribution.toolcacheFolderName).toBe(expected);
    }
  );
});

describe('findPackageForDownload', () => {
  it.each([
    ['8', '8.0.302+8'],
    ['16', '16.0.2+7'],
    ['16.0', '16.0.2+7'],
    ['16.0.2', '16.0.2+7'],
    ['8.x', '8.0.302+8'],
    ['x', '16.0.2+7']
  ])('version is resolved correctly %s -> %s', async (input, expected) => {
    const distribution = new AdoptiumDistribution(
      { version: '8', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptiumImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => manifestData;
    const resolvedVersion = await distribution['findPackageForDownload'](input);
    expect(resolvedVersion.version).toBe(expected);
  });

  it('version is found but binaries list is empty', async () => {
    const distribution = new AdoptiumDistribution(
      { version: '9.0.8', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptiumImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => manifestData;
    await expect(distribution['findPackageForDownload']('9.0.8')).rejects.toThrowError(
      /Could not find satisfied version for SemVer */
    );
  });

  it('version is not found', async () => {
    const distribution = new AdoptiumDistribution(
      { version: '7.x', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptiumImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => manifestData;
    await expect(distribution['findPackageForDownload']('7.x')).rejects.toThrowError(
      /Could not find satisfied version for SemVer */
    );
  });

  it('version list is empty', async () => {
    const distribution = new AdoptiumDistribution(
      { version: '8', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptiumImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => [];
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrowError(
      /Could not find satisfied version for SemVer */
    );
  });
});
