import { describe, expect, it } from "vitest";
import { isNewerVersion, parseAndroidUpdate } from "./androidUpdate";

describe("parseAndroidUpdate", () => {
  it("accepts a tagged release with a GitHub APK and SHA-256 digest", () => {
    expect(
      parseAndroidUpdate({
        tag_name: "v1.2.7",
        assets: [
          {
            name: "eu-vou-programar.apk",
            browser_download_url: "https://github.com/example/app/releases/download/v1.2.7/eu-vou-programar.apk",
            digest: `sha256:${"a".repeat(64)}`,
          },
        ],
      }),
    ).toEqual({
      version: "1.2.7",
      url: "https://github.com/example/app/releases/download/v1.2.7/eu-vou-programar.apk",
      sha256: "a".repeat(64),
    });
  });

  it("rejects releases without a verifiable APK", () => {
    expect(parseAndroidUpdate({ tag_name: "v1.2.7", assets: [] })).toBeNull();
  });
});

describe("isNewerVersion", () => {
  it("compares semantic version components numerically", () => {
    expect(isNewerVersion("1.10.0", "1.9.9")).toBe(true);
    expect(isNewerVersion("1.2.6", "1.2.6")).toBe(false);
    expect(isNewerVersion("1.2.5", "1.2.6")).toBe(false);
  });
});