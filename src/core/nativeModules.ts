/**
 * Safe detection of Expo native modules in current runtime environment.
 * Prevents uncaught exceptions ("Cannot find native module '...'") when running
 * in runtime environments where a specific native module is not linked or compiled.
 */
export function isExpoNativeModuleAvailable(moduleName: string): boolean {
  // 1. Direct JSI runtime host object inspection (Expo SDK 50+ modern architecture)
  if (typeof globalThis !== 'undefined') {
    const expoModules = (globalThis as any).expo?.modules;
    if (expoModules && expoModules[moduleName]) {
      return true;
    }
  }

  // 2. React Native NativeModules / TurboModuleRegistry inspection
  try {
    const { NativeModules, TurboModuleRegistry } = require('react-native');
    if (NativeModules && NativeModules[moduleName]) {
      return true;
    }
    if (TurboModuleRegistry && typeof TurboModuleRegistry.get === 'function') {
      if (TurboModuleRegistry.get(moduleName) != null) {
        return true;
      }
    }
  } catch {}

  // 3. Expo module core helper if present in bundle
  try {
    const expo = require('expo');
    if (typeof expo?.requireOptionalNativeModule === 'function') {
      return expo.requireOptionalNativeModule(moduleName) != null;
    }
  } catch {}

  return false;
}
