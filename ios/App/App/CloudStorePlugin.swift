import Foundation
import Capacitor

/// Syncs small string values across the player's devices with iCloud
/// key-value storage. Without an iCloud account it behaves like local storage.
///
/// JS: Capacitor.nativePromise('CloudStore', 'get', { key })      -> { value }
///     Capacitor.nativePromise('CloudStore', 'set', { key, value })
///     Capacitor.addListener('CloudStore', 'change', ({ key, value }) => ...)
@objc(CloudStorePlugin)
public class CloudStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudStorePlugin"
    public let jsName = "CloudStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    private let store = NSUbiquitousKeyValueStore.default

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(storeDidChange(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )
        store.synchronize()
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { return call.reject("Missing key") }
        call.resolve(["value": store.string(forKey: key) ?? ""])
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            return call.reject("Missing key or value")
        }
        store.set(value, forKey: key)
        store.synchronize()
        call.resolve()
    }

    // Another device changed a value: tell the web app.
    @objc private func storeDidChange(_ notification: Notification) {
        let keys = notification.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
        for key in keys {
            notifyListeners("change", data: ["key": key, "value": store.string(forKey: key) ?? ""])
        }
    }
}

/// The app's root view controller; registers the app's own plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CloudStorePlugin())
    }
}
