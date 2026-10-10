import Foundation

// One-shot cue as a single keyframe timeline: fade in → hold → fade out. The
// whole motion is handed to Core Animation once and then runs on the render
// server, so every run has the same duration and the same curve regardless of
// what the app is doing (MAC-0.1.32). Seconds throughout.
struct CueTimeline: Equatable {
    static let reducedMotionCap = 0.15
    static let minimumFade = 0.05
    let fadeIn: Double
    let hold: Double
    let fadeOut: Double

    init(fadeIn: Double, hold: Double, fadeOut: Double, reduceMotion: Bool = false) {
        func clean(_ value: Double, floor: Double) -> Double { value.isFinite ? max(floor, value) : floor }
        var fadeIn = clean(fadeIn, floor: Self.minimumFade), fadeOut = clean(fadeOut, floor: Self.minimumFade)
        if reduceMotion { fadeIn = min(fadeIn, Self.reducedMotionCap); fadeOut = min(fadeOut, Self.reducedMotionCap) }
        self.fadeIn = fadeIn; self.hold = clean(hold, floor: 0); self.fadeOut = fadeOut
    }

    var total: Double { fadeIn + hold + fadeOut }
    /// Normalised key times for values [start, peak, peak, end].
    var keyTimes: [Double] { [0, fadeIn / total, (fadeIn + hold) / total, 1] }
    /// Values for one animated property. A cue arriving while another is still
    /// visible continues from the current value instead of snapping to the floor.
    func values(from start: Double, peak: Double, end: Double) -> [Double] { [start, peak, peak, end] }

    /// Mirror check: fade-in and fade-out take the same share only if configured
    /// so; the curve itself is the same ease on both segments.
    var segmentCount: Int { keyTimes.count - 1 }
}

/// Visual recipe for a style/intensity, expressed in the same alphas the web
/// overlay used (hint-overlay.css), so both renderers look alike.
struct CueRecipe: Equatable {
    enum Style: Int { case vignette = 0, softFocus = 1, desaturate = 2, ambientGlow = 3, washFocus = 4 }
    let style: Style
    let vignetteEdge: Double, vignetteMid: Double
    let focusVeil: Double, desaturateVeil: Double
    let ambientAlpha: Double, ambientPetrolAlpha: Double, ambientEdgeAlpha: Double
    let comboColorAlpha: Double, comboVeil: Double
    let saturationMin: Double
    let blurRadius: Double

    static func make(style: Int, intensity: Int, blur: Double) -> CueRecipe {
        let level = max(0, min(2, intensity - 1))
        let style = Style(rawValue: style) ?? .vignette
        let blur = blur.isFinite ? max(0.5, min(10, blur)) : [1.4, 2.7, 4.4][level]
        return CueRecipe(
            style: style,
            vignetteEdge: [0.22, 0.34, 0.48][level], vignetteMid: [0.092, 0.143, 0.202][level],
            focusVeil: [0.06, 0.09, 0.13][level], desaturateVeil: [0.012, 0.022, 0.035][level],
            ambientAlpha: [0.24, 0.38, 0.56][level], ambientPetrolAlpha: [0.197, 0.312, 0.459][level], ambientEdgeAlpha: [0.043, 0.068, 0.101][level],
            comboColorAlpha: [0.055, 0.085, 0.12][level], comboVeil: [0.009, 0.013, 0.02][level],
            saturationMin: [0.76, 0.56, 0.34][level],
            blurRadius: blur)
    }
    var usesBlur: Bool { style == .softFocus || style == .washFocus }
    var usesSaturation: Bool { style == .desaturate }
}
