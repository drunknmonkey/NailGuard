import Foundation
@main struct GateTests {
    static func temporalTests() {
        // First hit: 350 ms qualification + 2 s hold, rounded to sample cadence.
        for disrupted in [false, true] {
            var gate = ProximityGate()
            for i in 0..<47 {
                let d: Double? = disrupted && i == 20 ? nil : (disrupted && i == 30 ? 0.35 : 0.2)
                assert(!gate.update(distance:d, now:Double(i)/20), "No early hit")
            }
            assert(gate.update(distance:0.2, now:2.4), "Missing frame and hysteresis jitter preserve hold")
            for i in 49...800 {
                assert(!gate.update(distance:0.2, now:Double(i)/20))
                assert(gate.active, "A sustained cue stays active without repeat moments")
            }
            _ = gate.update(distance:nil,now:40.1); assert(gate.active && gate.uncertain)
            assert(!gate.update(distance:0.2,now:40.3)); assert(gate.active)
            for i in 0...14 { _ = gate.update(distance:0.9,now:40.4+Double(i)/20) }
            assert(!gate.active && !gate.episode, "650 ms withdrawal releases the episode")
            for i in 0...48 { _ = gate.update(distance:0.2,now:42+Double(i)/20) }
            assert(gate.active, "New approach can trigger without cooldown")
            for i in 0...82 { _ = gate.update(distance:nil,now:44.5+Double(i)/10) }
            assert(!gate.active && gate.uncertain && gate.episode)
            assert(!gate.update(distance:0.2,now:53)); assert(!gate.active, "A single point cannot revive an expired cue")
            for i in 1...14 { assert(!gate.update(distance:0.2,now:53+Double(i)/20)) }
            assert(gate.active, "Stable reacquisition is the same episode")
            _ = gate.update(distance:nil,now:53.8); _ = gate.update(distance:nil,now:55.1)
            assert(gate.active, "Existing eight-second occlusion grace remains")
            gate.reset(); assert(!gate.active && !gate.episode)
        }
        var gate = ProximityGate()
        for i in 0...40 { _ = gate.update(distance:0.2,now:Double(i)/20) }
        for i in 41...55 { assert(!gate.update(distance:nil,now:Double(i)/20)) }
        assert(!gate.update(distance:0.2,now:2.8), "Long tracking gap resets hold")
        assert(!gate.active)
        gate.reset()
        for i in 0...40 { _ = gate.update(distance:0.2,now:Double(i)/20) }
        assert(!gate.update(distance:0.2,now:10), "Missing callbacks cannot complete a hold")
        gate.reset()
        for i in 0...40 { _ = gate.update(distance:0.2,now:Double(i)/20) }
        for i in 41...58 { assert(!gate.update(distance:0.6,now:Double(i)/20)) }
        assert(!gate.update(distance:0.2,now:3), "Confirmed withdrawal resets approach")
        gate.reset()
        for i in 0...100 { assert(!gate.update(distance:0.35,now:Double(i)/20), "Band alone cannot enter") }
        gate.reset()
        for i in 0...46 { assert(!gate.update(distance:0.2,now:Double(i)/20)) }
        assert(!gate.update(distance:nil,now:2.4), "Missing evidence cannot itself trigger")
        assert(gate.update(distance:0.2,now:2.5), "Short gap preserves qualified hold")
        gate.reset()
        for i in 0...100 {
            assert(!gate.update(distance:i % 6 == 0 ? 0.2 : 0.38,now:Double(i)/20), "Brief approaches do not accumulate")
        }
        for value in [Double.nan, Double.infinity, -0.1] {
            gate.reset()
            for i in 0...60 { assert(!gate.update(distance:value,now:Double(i)/20)) }
        }
    }
    static func reacquisitionTests() {
        var gate = ProximityGate()
        for i in 0...50 { _ = gate.update(distance:0.2,now:Double(i)/20) }
        assert(gate.active)
        _ = gate.update(distance:0.2,now:12)
        assert(!gate.active, "A callback gap expires the cue even without a nil sample")
        for i in 1...12 { _ = gate.update(distance:0.2,now:12+Double(i)/20) }
        assert(!gate.active)
        _ = gate.update(distance:nil,now:12.65)
        _ = gate.update(distance:0.2,now:12.7)
        _ = gate.update(distance:0.35,now:12.8)
        _ = gate.update(distance:0.2,now:13)
        for i in 1...12 { _ = gate.update(distance:0.2,now:13+Double(i)/20) }
        assert(!gate.active, "Missing or band points reset reacquisition")
        assert(!gate.update(distance:0.2,now:13.7)); assert(gate.active)
        // A confidently absent hand is withdrawal; low-confidence points on a still-visible hand remain occlusion.
        var removed = ProximityGate()
        for i in 0...50 { _ = removed.update(distance:0.2,now:Double(i)/20,handVisible:true) }
        assert(removed.active)
        for i in 1...11 { _ = removed.update(distance:nil,now:2.5+Double(i)/20,handVisible:false) }
        assert(!removed.active && !removed.episode && !removed.uncertain)
        var covered = ProximityGate()
        for i in 0...50 { _ = covered.update(distance:0.2,now:Double(i)/20,handVisible:true) }
        for i in 1...40 { _ = covered.update(distance:nil,now:2.5+Double(i)/20,handVisible:true) }
        assert(covered.active && covered.episode && covered.uncertain, "Visible hand with hidden points keeps the cue")
        for i in 0...14 { _ = gate.update(distance:0.8,now:14+Double(i)/20) }
        assert(!gate.episode && !gate.active)
        _ = gate.update(distance:0.2,now:15)
        assert(!gate.active, "Confirmed removal needs a full new approach")
    }
    static func main() {
        reacquisitionTests()
        assert(AnalysisGeometry.size(width:1920,height:1080,detail:false) == (640,360))
        assert(AnalysisGeometry.size(width:1920,height:1080,detail:true) == (1280,720))
        assert(AnalysisGeometry.size(width:640,height:480,detail:true) == (640,480))
        assert(AnalysisGeometry.size(width:1080,height:1920,detail:false) == (270,480))
        assert(CameraChoice.automaticID(ids: [], available: [], remembered: nil) == nil)
        assert(CameraChoice.automaticID(ids: ["internal"], available: ["internal"], remembered: nil) == "internal")
        assert(CameraChoice.automaticID(ids: ["internal"], available: [], remembered: "internal") == nil, "Ruhende interne Kamera nie starten")
        assert(CameraChoice.automaticID(ids: ["internal", "usb"], available: ["internal", "usb"], remembered: "internal") == nil, "Mehrere Kameras erfordern Bestätigung")
        assert(CameraChoice.automaticID(ids: ["internal", "usb"], available: ["usb"], remembered: "internal") == nil, "Zugeklappt mit Webcam: Auswahl zeigen")
        assert(CameraChoice.automaticID(ids: ["internal"], available: ["internal"], remembered: "usb") == nil, "Abgezogene Webcam erlaubt keinen stillen Wechsel")
        assert(CameraChoice.automaticID(ids: ["usb"], available: ["usb"], remembered: "usb") == "usb")
        assert(DetectionPolicy.distance(tip: 0.7, adjacent: 0.2, episode: false, fallback: true) == 0.7, "A visible tip wins over a nearer joint")
        assert(DetectionPolicy.distance(tip: nil, adjacent: 0.2, episode: false, fallback: true) == 0.2)
        assert(DetectionPolicy.distance(tip: nil, adjacent: 0.2, episode: false, fallback: false) == nil)
        assert(DetectionPolicy.distance(tip: nil, adjacent: nil, episode: false, fallback: true) == nil)
        assert(DetectionPolicy.distance(tip: 0.7, adjacent: 0.2, episode: true, fallback: false) == 0.2, "Existing active-episode support remains")
        var cue = SoundCuePolicy()
        assert(cue.update(visible: true, enabled: true, now: 0))
        assert(!cue.update(visible: true, enabled: true, now: 5), "No repeats during a held cue")
        assert(!cue.update(visible: false, enabled: true, now: 6))
        assert(cue.update(visible: true, enabled: true, now: 7), "Reacquired visual cue gets sound without another review moment")
        assert(!cue.update(visible: false, enabled: true, now: 8))
        assert(!cue.update(visible: true, enabled: true, now: 8.1), "Cooldown prevents rapid repeated sounds")
        assert(!cue.update(visible: false, enabled: false, now: 12))
        assert(!cue.update(visible: true, enabled: false, now: 13), "Disabled sound stays silent")
        assert(!cue.update(visible: true, enabled: true, now: 14), "Enabling sound does not replay a held cue")
        cue = SoundCuePolicy()
        assert(cue.update(visible: true, enabled: true, now: 14.1), "A new camera session resets the sound policy")
        temporalTests()
        let suite = "tawel.tests." + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let review = ReviewStore(defaults: defaults)
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let day = ReviewStore.dayKey(date)
        for i in 0...100 { review.sample(now: Double(i)/10, date: date, valid: true, quiet: true, moment: false) }
        assert(abs(review.days[day]!.observedSeconds - 10) < 0.001)
        review.interrupt()
        review.sample(now: 100, date: date, valid: true, quiet: true, moment: false)
        assert(abs(review.days[day]!.observedSeconds - 10) < 0.001, "Pause is not observed time")
        review.sample(now: 100.1, date: date, valid: false, quiet: false, moment: false)
        review.sample(now: 100.2, date: date, valid: true, quiet: false, moment: true)
        review.save()
        let restored = ReviewStore(defaults: defaults)
        assert(restored.days[day]!.moments == 1)
        assert(restored.days[day]!.hourly.reduce(0,+) == 1)
        assert(abs(restored.days[day]!.longestQuietSeconds - 10) < 0.001)
        print("Native proximity and camera choice tests: ok")
    }
}
