import AppKit
import Foundation

struct SoundPreferences: Codable {
    var enabled = false
    var preset = 0
    var volume = 0.35
}
// Same note sequences as the Web app. NSSound playback lives outside WebKit.
final class NativeAudio {
    static let shared = NativeAudio()
    private var sound: NSSound?
    private let preparation = DispatchQueue(label: "app.tawel.sound", qos: .userInitiated)
    private var waves: [Int: Data] = [:]
    private let lock = NSLock()
    private var generation = 0
    private init() {
        preparation.async { for preset in 0...4 { self.waves[preset] = self.makeWave(preset: preset) } }
    }
    func cancel() {
        lock.lock(); generation += 1; lock.unlock()
        DispatchQueue.main.async { self.sound?.stop() }
    }
    func play(preset: Int, volume: Double, completion: ((Double, Bool) -> Void)? = nil) {
        let requested = ProcessInfo.processInfo.systemUptime
        lock.lock(); generation += 1; let ticket = generation; lock.unlock()
        preparation.async {
            let preset = max(0,min(4,preset))
            let data = self.waves[preset] ?? self.makeWave(preset: preset)
            self.waves[preset] = data
            DispatchQueue.main.async {
                self.lock.lock(); let current = ticket == self.generation; self.lock.unlock()
                guard current else { completion?((ProcessInfo.processInfo.systemUptime-requested)*1000, false); return }
                self.sound?.stop()
                self.sound = NSSound(data: data)
                self.sound?.volume = Float(max(0,min(1,volume)))
                let started = self.sound?.play() ?? false
                completion?((ProcessInfo.processInfo.systemUptime-requested)*1000, started)
            }
        }
    }
    private func makeWave(preset: Int) -> Data {
        let notes: [[(Double, Double, Double, Int)]] = [
            [(420,0,0.08,0),(760,0.07,0.12,0)],
            [(240,0,0.08,0),(240,0.14,0.08,0)],
            [(392,0,0.22,1),(494,0.26,0.28,1),(587,0.56,0.34,1)],
            [(660,0,0.07,2),(520,0.09,0.07,2),(780,0.18,0.09,2)],
            [(260,0,0.16,3),(180,0.1,0.22,0)]
        ]
        let chosen = notes[max(0,min(4,preset))]
        let rate = 44100.0
        let count = Int(((chosen.map { $0.1 + $0.2 }.max() ?? 1) + 0.03) * rate)
        var samples = Array(repeating: 0.0, count: count)
        for (frequency,delay,duration,kind) in chosen {
            var phase = 0.0
            for i in 0..<Int(duration * rate) {
                let t = Double(i)/rate
                let f = kind == 3 ? frequency * pow(0.58,t/duration) : frequency
                phase += f/rate
                let wave: Double
                switch kind {
                case 1: wave = 2 / Double.pi * asin(sin(2 * Double.pi * phase))
                case 2: wave = sin(2 * Double.pi * phase) >= 0 ? 1 : -1
                case 3: wave = 2 * (phase - floor(phase)) - 1
                default: wave = sin(2 * Double.pi * phase)
                }
                let envelope = t < 0.018 ? 0.0001 * pow(8000,t/0.018) : 0.8 * pow(0.000125,(t-0.018)/(duration-0.018))
                samples[Int(delay*rate)+i] += wave * envelope * 0.22
            }
        }
        var data = Data()
        func ascii(_ s: String) { data.append(contentsOf: s.utf8) }
        func u16(_ v: UInt16) { data.append(UInt8(v & 255)); data.append(UInt8(v >> 8)) }
        func u32(_ v: UInt32) { u16(UInt16(v & 65535)); u16(UInt16(v >> 16)) }
        ascii("RIFF"); u32(UInt32(36+count*2)); ascii("WAVEfmt "); u32(16); u16(1); u16(1)
        u32(44100); u32(88200); u16(2); u16(16); ascii("data"); u32(UInt32(count*2))
        for sample in samples { u16(UInt16(bitPattern: Int16(max(-1,min(1,sample))*32767))) }
        return data
    }
}
