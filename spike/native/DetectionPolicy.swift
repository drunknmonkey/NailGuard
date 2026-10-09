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

// Fit without cropping, stretching or upscaling; normalized landmarks stay aligned.
enum AnalysisGeometry {
    static func size(width: Int, height: Int, detail: Bool) -> (Int, Int) {
        guard width > 0 && height > 0 else { return (0,0) }
        let scale = min(1, min(Double(detail ? 1280 : 640)/Double(width), Double(detail ? 720 : 480)/Double(height)))
        return (max(1,Int((Double(width)*scale).rounded(.down))), max(1,Int((Double(height)*scale).rounded(.down))))
    }
}
