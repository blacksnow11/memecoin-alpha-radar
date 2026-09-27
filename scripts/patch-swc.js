const fs = require('fs');
const path = require('path');

const swcIndexPath = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'build', 'swc', 'index.js');

if (fs.existsSync(swcIndexPath)) {
  let content = fs.readFileSync(swcIndexPath, 'utf8');

  // Ensure shouldLoadWasmFallbackFirst includes true
  if (!content.includes('process.env.NEXT_FORCE_WASM === "1" || true')) {
    content = content.replace(
      'const shouldLoadWasmFallbackFirst = !disableWasmFallback && unsupportedPlatform && useWasmBinary || isWebContainer;',
      'const shouldLoadWasmFallbackFirst = !disableWasmFallback && (unsupportedPlatform && useWasmBinary || isWebContainer || process.env.NEXT_FORCE_WASM === "1" || true);'
    );
  }

  // Ensure loadWasm resolves package directly
  if (!content.includes('bindings = require(pkg);')) {
    content = content.replace(
      `            let pkgPath = pkg;
            if (importPath) {
                // the import path must be exact when not in node_modules
                pkgPath = _path.default.join(importPath, pkg, "wasm.js");
            }
            let bindings = await import((0, _url.pathToFileURL)(pkgPath).toString());`,
      `            let bindings;
            if (importPath) {
                const pkgPath = _path.default.join(importPath, pkg, "wasm.js");
                bindings = await import((0, _url.pathToFileURL)(pkgPath).toString());
            } else {
                try {
                    bindings = require(pkg);
                } catch {
                    bindings = await import(pkg);
                }
            }`
    );
  }

  fs.writeFileSync(swcIndexPath, content, 'utf8');
  console.log('✅ Next.js SWC WASM patch applied successfully.');
} else {
  console.log('⚠️ next/dist/build/swc/index.js not found, skipping patch.');
}
