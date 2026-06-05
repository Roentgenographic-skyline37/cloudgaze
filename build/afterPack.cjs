// Ad-hoc code-sign the packaged macOS .app.
//
// CloudGaze has no (paid) Apple Developer ID, so CI builds with signing
// disabled. But electron-builder repackaging invalidates Electron's own
// signature, and macOS — especially Apple Silicon — refuses to launch an
// unsigned binary, reporting it as "damaged and can't be opened".
//
// An ad-hoc signature (`codesign --sign -`) carries no identity but satisfies
// the OS's signature requirement, so the app launches. It is still
// un-notarized, so on first run users do the normal Gatekeeper bypass
// (right-click -> Open). This hook is a no-op on Windows/Linux.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename; // "CloudGaze"
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[afterPack] ad-hoc signing ${appPath}`);
  // --deep so the nested Electron Framework/helpers are signed too.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  // Surface the result in the build log for sanity.
  execFileSync('codesign', ['--verify', '--verbose=2', appPath], { stdio: 'inherit' });
};
