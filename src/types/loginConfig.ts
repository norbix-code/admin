// Back-compat shim. The config that drives branding + the login screen is now
// modeled in projectConfig.ts (richer brand palette). Existing imports of
// '@/types/loginConfig' keep working via these re-exports.
export * from './projectConfig';
