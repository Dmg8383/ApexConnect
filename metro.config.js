const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ── Exclude Electron's Node.js files from Metro bundling ─────────────────────
// Metro scans the whole project directory. Without this, it picks up
// electron/main.js and tries to run it through babel-preset-expo, which
// fails because it's a plain Node.js file (not React Native).
const { BlockList } = require('metro-config');
config.resolver.blockList = [
  // Exclude the entire electron/ directory
  /.*[/\\]electron[/\\].*/,
  // Exclude electron build output
  /.*[/\\]dist-electron[/\\].*/,
];

// ── Targeted fix: redirect zustand ESM (.mjs) imports to CJS on web ──────────
// zustand v5's ESM files contain `import.meta.env.MODE` which Metro's web
// bundler doesn't support. We force the CJS equivalents per-module.
// This keeps `unstable_enablePackageExports` enabled (default), so
// expo-router and supabase-js still resolve their internal paths correctly.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const zustandCjsMap = {
      'zustand': 'index.js',
      'zustand/middleware': 'middleware.js',
      'zustand/react': 'react.js',
      'zustand/vanilla': 'vanilla.js',
      'zustand/traditional': 'traditional.js',
      'zustand/shallow': 'shallow.js',
    };

    if (zustandCjsMap[moduleName]) {
      const zustandDir = path.dirname(
        require.resolve('zustand/package.json', { paths: [__dirname] })
      );
      const cjsPath = path.join(zustandDir, zustandCjsMap[moduleName]);
      if (fs.existsSync(cjsPath)) {
        return { filePath: cjsPath, type: 'sourceFile' };
      }
    }
  }

  // Fall through to Metro's default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
