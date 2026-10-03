// Shared by the native picker and regression tests. A remembered camera is a
// suggestion, never permission to silently switch between multiple devices.
struct CameraChoice {
    static func automaticID(ids: [String], available: Set<String>, remembered: String?) -> String? {
        guard ids.count == 1, let only = ids.first, available.contains(only),
              remembered == nil || remembered == only else { return nil }
        return only
    }
}
