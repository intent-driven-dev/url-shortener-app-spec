import { fileURLToPath } from 'node:url';

// Resolve from installed scripts, never the caller's working directory.
export const verificationRoot = fileURLToPath(new URL('../', import.meta.url));
export const specificationRoot = fileURLToPath(new URL('../../', import.meta.url));
