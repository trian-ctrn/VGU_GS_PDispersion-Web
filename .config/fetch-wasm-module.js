import { execSync } from "node:child_process";

// Update the module version when needed
// public API should not change, hopefully
execSync(`
    curl -L -o wasm.zip \
    https://github.com/LunaciaDev/VGU_GS_PDispersion-WASM/releases/download/v2.0/pdispersion-2.0.zip &&
    unzip -o wasm.zip -d pkg &&
    rm -f wasm.zip
`, { stdio: 'inherit' });