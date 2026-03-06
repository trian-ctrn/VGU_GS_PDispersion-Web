import { execSync } from "node:child_process";

// Update the module version when needed
// public API should not change, hopefully
execSync(`
    curl -L -o wasm.zip \
    https://github.com/LunaciaDev/VGU_GS_PDispersion-WASM/releases/download/v1.1/pdispersion-1.1.zip &&
    unzip -o wasm.zip -d pkg &&
    rm wasm.zip
`);