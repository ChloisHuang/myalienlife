# Atoll Island Preview

The patch targets Atoll v2.2.0, commit `c425ebb2768389f86dc03924bedcb175ff0eaeb9`.
It changes only the extension identified by `local.orbitlife.atoll-preview`:

- Both the SwiftUI content and native window use a screen-bounded 600 x 480 size.
- The web view fills the extension area without the native title or large icon.
- Other Atoll tabs retain their existing layout.

Apply `atoll-2.2.0.patch` to that exact source version. The project uses synchronized
source groups, so `OrbitIslandLayout.swift` is included automatically. Run the
standalone layout checks with:

```sh
swiftc -parse-as-library DynamicIsland/models/OrbitIslandLayout.swift OrbitIslandLayoutTests.swift -o /tmp/orbit-atoll-layout-tests
/tmp/orbit-atoll-layout-tests
```

The preview requires the game server on `127.0.0.1:5173`. Once Atoll is running and
the extension is authorized, register the tab from the game repository:

```sh
node tools/atoll-preview.mjs
```

The preview only reads `/api/save`, checks for updates every two seconds, and
does not advance the simulation or write saves. Updates become visible after the
main game saves. Missing saves display an error instead of creating a new game.

Original app and preferences backup:
`~/Library/Application Support/OrbitLife/Atoll-backups/20260908/`.
Local builds need local code signing; replacing the signed vendor app can require
macOS permissions to be granted again. An upstream app update can replace this
patch. Do not install a failed or unverified build over the working app.

## Local Verification Status

The patched Release build and four layout checks passed on September 8, 2026.
The Metal toolchain required by SwiftTerm was installed through Xcode.
Deployment is not complete: an ad-hoc signature cannot load the embedded Lottie
framework under hardened runtime, and signing with the available Apple Development
identity returned `errSecInternalComponent`. No library-validation or Gatekeeper
exception was added. The original signed app was restored, restarted, verified
with `codesign --verify --deep --strict`, and the save-backed preview was registered.
The compiled candidate is retained as `Atoll-patched-build.app` in the backup
directory; it is not a runnable release until its signing issue is resolved.
