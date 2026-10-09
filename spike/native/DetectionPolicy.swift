import Foundation

enum DetectionPolicy {
    static func distance(tip: Double?, adjacent: Double?, episode: Bool, fallback: Bool) -> Double? {
        if episode { return [tip, adjacent].compactMap { $0 }.min() }
        return tip ?? (fallback ? adjacent : nil)
    }
}
struct SoundCuePolicy {
    private var wasVisible = false
    private var lastSound = -Double.infinity
    mutating func update(visible: Bool, enabled: Bool, now: Double) -> Bool {
        let rising = visible && !wasVisible
        wasVisible = visible
        guard rising && enabled && now - lastSound >= 3 else { return false }
        lastSound = now
        return true
    }
}
