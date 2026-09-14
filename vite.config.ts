import vinext from 'vinext';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

export default defineConfig(() => {
  const isVercel =
    process.env.VERCEL === '1' || process.env.NITRO_PRESET === 'vercel';
  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [vinext(), ...(isVercel ? [nitro()] : [])],
  };
});
