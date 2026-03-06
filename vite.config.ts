import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm';
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    base: process.env.VITE_BASE ?? "/",
    plugins: [
        react(),
        wasm()
    ],
})
