// Bridge to native plugins when running inside the Capacitor app.
// In the browser every call is a harmless no-op.

const cap = window.Capacitor;

export const isNative = !!cap?.isNativePlatform?.();

// Calls a native plugin method; resolves to undefined in the browser.
export function callNative(plugin, method, options) {
  if (!isNative) return Promise.resolve(undefined);
  return cap.nativePromise(plugin, method, options);
}

// Listens to a native plugin event; does nothing in the browser.
export function onNative(plugin, event, callback) {
  if (isNative) cap.addListener(plugin, event, callback);
}
