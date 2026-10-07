# Android releases and updates

Pushing a Git Flow release tag in the form `MAJOR.MINOR.PATCH` (or `vMAJOR.MINOR.PATCH`) builds a signed APK and publishes it as `eu-vou-programar.apk` in a GitHub Release. Installed Android apps check the latest release at startup, verify the APK's SHA-256 digest, and open Android's package installer. Android still requires the user to approve installation.

## Configure signing

The current APK uses this machine's Android debug keystore. To preserve in-place updates, add these repository Actions secrets using that same keystore:

- `ANDROID_KEYSTORE_BASE64`: Base64 contents of `%USERPROFILE%\.android\debug.keystore`. In PowerShell, generate the value with `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.android\debug.keystore"))` and paste it directly into the GitHub secret. Do not commit the keystore or its encoded contents.
- `ANDROID_KEYSTORE_PASSWORD`: `android`
- `ANDROID_KEY_ALIAS`: `androiddebugkey`
- `ANDROID_KEY_PASSWORD`: `android`

Reusing the debug key preserves compatibility with already-installed APKs, but it is a compromise for production signing. Keep the keystore secret restricted and back it up securely; losing it prevents in-place updates.

## Publish a version

Finish the Git Flow release and push its tag:

```sh
git flow release start 1.2.7
git flow release finish 1.2.7
git push origin main --follow-tags
```

The tag `1.2.7` created by Git Flow triggers the Android release workflow; a `v` prefix is also accepted. Keep each version component below 1000 so the generated Android `versionCode` stays ordered.
If your Git Flow setup also has a `develop` branch, push it separately after finishing the release.