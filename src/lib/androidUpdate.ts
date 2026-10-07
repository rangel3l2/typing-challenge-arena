export interface AndroidReleaseAsset {
  name: string;
  browser_download_url: string;
  digest?: string | null;
}

export interface AndroidRelease {
  tag_name: string;
  assets: AndroidReleaseAsset[];
}

export interface AndroidUpdate {
  version: string;
  url: string;
  sha256: string;
}

export function parseAndroidUpdate(release: AndroidRelease): AndroidUpdate | null {
  const version = release.tag_name.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;

  const asset = release.assets.find((item) => item.name === "eu-vou-programar.apk");
  const checksum = asset?.digest?.match(/^sha256:([a-f\d]{64})$/i)?.[1];
  if (!asset || !checksum || !asset.browser_download_url.startsWith("https://github.com/")) {
    return null;
  }

  return { version, url: asset.browser_download_url, sha256: checksum.toLowerCase() };
}

export function isNewerVersion(latest: string, installed: string): boolean {
  const parse = (version: string) => {
    const match = version.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  };
  const latestParts = parse(latest);
  const installedParts = parse(installed);
  if (!latestParts || !installedParts) return false;

  for (let index = 0; index < latestParts.length; index += 1) {
    if (latestParts[index] !== installedParts[index]) {
      return latestParts[index] > installedParts[index];
    }
  }
  return false;
}