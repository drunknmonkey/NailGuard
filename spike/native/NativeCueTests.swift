import Foundation

@main struct NativeCueTests {
    static func main() {
        let timeline = CueTimeline(fadeIn: 0.65, hold: 1.0, fadeOut: 0.45)
        assert(abs(timeline.total - 2.1) < 1e-9)
        assert(timeline.keyTimes.count == 4 && timeline.keyTimes.first == 0 && timeline.keyTimes.last == 1)
        assert(abs(timeline.keyTimes[1] - 0.65 / 2.1) < 1e-9 && abs(timeline.keyTimes[2] - 1.65 / 2.1) < 1e-9, "Hold sits between the two fades")
        assert(timeline.values(from: 0, peak: 1, end: 0) == [0, 1, 1, 0])
        assert(timeline.values(from: 0.4, peak: 1, end: 0) == [0.4, 1, 1, 0], "A cue arriving mid-fade continues from the current level")
        assert(timeline.values(from: 1, peak: 0.56, end: 1) == [1, 0.56, 0.56, 1], "Saturation runs from 1 down to the minimum and back")
        assert(timeline.segmentCount == 3, "Three timing functions: ease, linear hold, ease")
        let reduced = CueTimeline(fadeIn: 1.3, hold: 1.0, fadeOut: 1.3, reduceMotion: true)
        assert(reduced.fadeIn == CueTimeline.reducedMotionCap && reduced.fadeOut == CueTimeline.reducedMotionCap && reduced.hold == 1.0, "Reduce Motion shortens the fades, not the hold")
        let short = CueTimeline(fadeIn: 0.1, hold: 0, fadeOut: 0.1, reduceMotion: true)
        assert(short.fadeIn == 0.1, "Reduce Motion never lengthens a fade")
        let broken = CueTimeline(fadeIn: .nan, hold: -3, fadeOut: 0)
        assert(broken.fadeIn == CueTimeline.minimumFade && broken.hold == 0 && broken.fadeOut == CueTimeline.minimumFade && broken.total > 0, "Garbage input still yields a finite, playable timeline")
        let strong = CueRecipe.make(style: 1, intensity: 3, blur: 4)
        assert(strong.style == .softFocus && strong.usesBlur && !strong.usesSaturation && strong.blurRadius == 4 && strong.focusVeil == 0.13)
        let fallback = CueRecipe.make(style: 9, intensity: 7, blur: .infinity)
        assert(fallback.style == .vignette && fallback.blurRadius == 4.4 && fallback.vignetteEdge == 0.48, "Unknown style and intensity clamp to known values")
        assert(CueRecipe.make(style: 2, intensity: 1, blur: 2).saturationMin == 0.76 && CueRecipe.make(style: 2, intensity: 1, blur: 2).usesSaturation)
        assert(CueRecipe.make(style: 4, intensity: 2, blur: 0.1).blurRadius == 0.5, "Blur clamps to the slider range")
        print("Native cue timeline and recipe tests: ok")
    }
}
