import AppKit
import AVFoundation
import Vision
import CoreMedia
import CoreImage
import Darwin

private typealias NativeCallback = @convention(c) (Int32, Double, Double) -> Void
private final class NativeEngine: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    static let shared = NativeEngine()
    private let queue = DispatchQueue(label: "app.tawel.native-capture")
    private let session = AVCaptureSession()
    private var callback: NativeCallback?
    private var lastDeviceFlags: Int?
    private var selectedDevice: AVCaptureDevice?
    private let cameraNameLock = NSLock()
    private var selectedName = "Noch keine Kamera gewählt"
    private var selectionPending = false
    private var generation = 0
    private let cameraKey = "tawel.native.camera.v1"
    private var videoOutput: AVCaptureVideoDataOutput?
    private var configured = false
    private var wanted = false
    private var sleeping = false
    private var snoozeUntil: Date?
    private var gate = ProximityGate()
    private var soundCue = SoundCuePolicy()
    private var detail = UserDefaults.standard.object(forKey: "tawel.native.detail.v1") as? Bool ?? true
    private var fingerFallback = UserDefaults.standard.object(forKey: "tawel.native.fallback.v1") as? Bool ?? true
    private var lastCPU: (time: Double, cpu: Double)?
    private let analysisFrame = AnalysisFrame()
    private let review = ReviewStore()
    private var soundPreferences = UserDefaults.standard.data(forKey: "tawel.native.sound.v1").flatMap { try? JSONDecoder().decode(SoundPreferences.self, from: $0) } ?? SoundPreferences()
    private var analysisAfter = 0.0
    private var announcedActive = false
    private var lastProcessed = -Double.infinity
    private var lastFrameAt = Date()
    private var lastRestart = Date.distantPast
    private var activity: NSObjectProtocol?
    private var observers: [NSObjectProtocol] = []
    private var watchdog: DispatchSourceTimer?
    // JPEG work is isolated from the serial camera/Vision queue.
    private let previewQueue = DispatchQueue(label: "app.tawel.preview", qos: .utility)
    private let preview = PreviewMailbox()
    private let previewContext = CIContext(options: [.cacheIntermediates: false, .useSoftwareRenderer: true])
    func previewJSON(enabled: Bool) -> String {
        preview.read(enabled: enabled, now: ProcessInfo.processInfo.systemUptime)
    }
    private func makePreview(_ image: CVPixelBuffer, now: Double) {
        guard let ticket = preview.reserve(now: now) else { return }
        var mouth: [[Double]] = [], center = [0.0, 0.0]
        if let observation = face.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }),
           let lips = observation.landmarks?.outerLips, lips.pointCount > 0 {
            let box = observation.boundingBox
            mouth = lips.normalizedPoints.map { [Double(box.minX + CGFloat($0.x) * box.width), Double(box.minY + CGFloat($0.y) * box.height)] }
            center = [mouth.map { $0[0] }.reduce(0,+) / Double(mouth.count), mouth.map { $0[1] }.reduce(0,+) / Double(mouth.count)]
        }
        let fingers: [[VNHumanHandPoseObservation.JointName]] = [
            [.wrist,.thumbCMC,.thumbMP,.thumbIP,.thumbTip], [.wrist,.indexMCP,.indexPIP,.indexDIP,.indexTip],
            [.wrist,.middleMCP,.middlePIP,.middleDIP,.middleTip], [.wrist,.ringMCP,.ringPIP,.ringDIP,.ringTip], [.wrist,.littleMCP,.littlePIP,.littleDIP,.littleTip]]
        var chains: [[[Double]]] = [], tips: [[Double]] = []
        for hand in hands.results ?? [] {
            for finger in fingers {
                var chain: [[Double]] = []
                for (index, joint) in finger.enumerated() {
                    guard let point = try? hand.recognizedPoint(joint), point.confidence >= 0.3 else {
                        if !chain.isEmpty { chains.append(chain); chain = [] }; continue
                    }
                    let xy = [Double(point.location.x), Double(point.location.y)]
                    chain.append(xy)
                    let tipConfidence = (try? hand.recognizedPoint(finger[4]))?.confidence ?? 0
                    if index == 4 || (index == 3 && (gate.active || (fingerFallback && tipConfidence < 0.3))) { tips.append(xy) }
                }
                if !chain.isEmpty { chains.append(chain) }
            }
        }
        // Snapshot the landmarks before Vision reuses its results. Holding one
        // pixel buffer is bounded; when encoding is slow, new preview work drops.
        let landmarks: [String: Any] = ["mouth":mouth, "center":center, "chains":chains, "tips":tips, "timestamp":now]
        previewQueue.async { [self] in
            autoreleasepool {
                let started = ProcessInfo.processInfo.systemUptime
                var json: String?
                let source = CIImage(cvPixelBuffer: image)
                let scale = min(1, PreviewMailbox.maxWidth / source.extent.width)
                let small = source.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
                if let cg = previewContext.createCGImage(small, from: small.extent),
                   let jpeg = NSBitmapImageRep(cgImage: cg).representation(using: .jpeg, properties: [.compressionFactor: PreviewMailbox.jpegQuality]) {
                    var value = landmarks
                    value["image"] = jpeg.base64EncodedString(); value["width"] = cg.width; value["height"] = cg.height
                    if let data = try? JSONSerialization.data(withJSONObject: value) { json = String(data:data, encoding:.utf8) }
                }
                let finished = ProcessInfo.processInfo.systemUptime
                preview.complete(ticket: ticket, frame: json, sourceTime: now, now: finished)
                queue.async { [self] in callback?(23, (finished - started) * 1000, 0) }
            }
        }
    }
    private let face = VNDetectFaceLandmarksRequest()
    private let hands = VNDetectHumanHandPoseRequest()

    override init() {
        super.init()
        _ = NativeAudio.shared
        hands.maximumHandCount = 2
        let notifications = NotificationCenter.default
        observers.append(notifications.addObserver(forName: NSNotification.Name.AVCaptureSessionRuntimeError, object: session, queue: nil) { [weak self] note in
            let error = note.userInfo?[AVCaptureSessionErrorKey] as? NSError
            self?.queue.async { [weak self] in
                self?.callback?(16, Double(error?.code ?? 0), 0)
                self?.diagnostic("runtime_error domain=\(error?.domain ?? "unknown") code=\(error?.code ?? 0)")
            }
        })
        let center = NSWorkspace.shared.notificationCenter
        observers.append(center.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: nil) { [weak self] _ in
            self?.queue.async { [weak self] in
                guard let self = self else { return }
                self.sleeping = true; self.stopSession(); self.report(8)
            }
        })
        observers.append(center.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: nil) { [weak self] _ in
            self?.queue.async { [weak self] in
                guard let self = self else { return }
                self.sleeping = false
                if self.wanted && self.snoozeUntil == nil { self.startSession() }
            }
        })
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + 1, repeating: 1)
        timer.setEventHandler { [weak self] in
            guard let self = self else { return }
            self.callback?(9, 0, 0) // Capture-Queue lebt, auch ohne Bilder.
            self.reportPerformance()
            if Date().timeIntervalSince(self.lastFrameAt) > 8 {
                _ = self.gate.update(distance: nil, now: ProcessInfo.processInfo.systemUptime)
                self.callback?(20, 0, 0); self.callback?(21, 1, 3); self.review.interrupt()
                _ = self.soundCue.update(visible: false, enabled: false, now: ProcessInfo.processInfo.systemUptime)
            }
            if self.wanted { self.reportCaptureState() }
            if let until = self.snoozeUntil, Date() >= until {
                self.snoozeUntil = nil
                if self.wanted && !self.sleeping { self.startSession() }
            }
            if self.wanted && !self.sleeping && self.snoozeUntil == nil && self.configured &&
                self.selectedDevice?.isConnected == true && self.selectedDevice?.isSuspended == false &&
                Date().timeIntervalSince(self.lastFrameAt) > 12 && Date().timeIntervalSince(self.lastRestart) > 15 {
                self.callback?(10, 0, 0)
                self.lastRestart = Date(); self.stopSession(); self.startSession()
            }
        }
        timer.resume(); watchdog = timer
    }

    // Nur lokale Gerätebeschreibung und technische Zustände, keine IDs/Bilder.
    private func reportPerformance() {
        let now = ProcessInfo.processInfo.systemUptime
        var usage = rusage()
        if getrusage(RUSAGE_SELF, &usage) == 0 {
            let cpu = Double(usage.ru_utime.tv_sec + usage.ru_stime.tv_sec) + Double(usage.ru_utime.tv_usec + usage.ru_stime.tv_usec) / 1_000_000
            if let previous = lastCPU, now > previous.time {
                callback?(24, max(0,(cpu-previous.cpu)/(now-previous.time)*100), Double(usage.ru_maxrss)/1_048_576)
            }
            lastCPU = (now,cpu)
        }
        callback?(28, soundPreferences.enabled ? 1 : 0, soundPreferences.volume)
        callback?(25, Double(ProcessInfo.processInfo.thermalState.rawValue), Double((detail ? 1 : 0) + (fingerFallback ? 2 : 0)))
    }
    func quality(detail: Bool, fallback: Bool) {
        queue.async {
            let changed = self.detail != detail
            self.detail = detail; self.fingerFallback = fallback
            UserDefaults.standard.set(detail, forKey: "tawel.native.detail.v1")
            UserDefaults.standard.set(fallback, forKey: "tawel.native.fallback.v1")
            if changed && self.configured {
                self.stopSession()
                self.session.beginConfiguration()
                for input in self.session.inputs { self.session.removeInput(input) }
                for output in self.session.outputs { self.session.removeOutput(output) }
                self.session.commitConfiguration()
                self.configured = false; self.videoOutput = nil
                if self.wanted && !self.sleeping && self.snoozeUntil == nil { self.startSession() }
            }
            self.reportPerformance()
        }
    }
    private func playCue(preset: Int, volume: Double) {
        callback?(29, 0, 0)
        NativeAudio.shared.play(preset: preset, volume: volume) { delay, started in
            self.queue.async { self.callback?(30, delay, started ? 1 : 0) }
        }
    }
    private func diagnostic(_ message: String) {
        guard let desktop = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask).first else { return }
        let url = desktop.appendingPathComponent("tawel-native-camera-debug.txt")
        let line = "\(ISO8601DateFormatter().string(from: Date())) \(message)\n"
        guard let data = line.data(using: .utf8) else { return }
        if !FileManager.default.fileExists(atPath: url.path) { FileManager.default.createFile(atPath: url.path, contents: nil) }
        if let file = try? FileHandle(forWritingTo: url) {
            defer { try? file.close() }
            do { try file.seekToEnd(); try file.write(contentsOf: data) } catch {}
        }
    }
    private func reportCaptureState() {
        let connection = videoOutput?.connection(with: .video)
        let connectionState = connection.map { ($0.isEnabled ? 1 : 0) | ($0.isActive ? 2 : 0) } ?? -1
        callback?(13, Double(connectionState), 0)
        if let device = selectedDevice {
            let flags = (device.isConnected ? 1 : 0) | (device.isSuspended ? 2 : 0)
            callback?(17, Double(flags), 0)
            if lastDeviceFlags != flags {
                diagnostic("device connected=\(device.isConnected) suspended=\(device.isSuspended)")
                lastDeviceFlags = flags
            }
        }
        callback?(15, -1, 0) // AVCaptureSession.isInterrupted ist unter macOS nicht verfügbar.
    }
    func setCallback(_ value: @escaping NativeCallback) { queue.async { self.callback = value } }
    private func report(_ status: Int32) { callback?(3, Double(status), 0) }
    func start(chooseCamera: Bool = false) {
        queue.async {
            guard !self.selectionPending else { return }
            if chooseCamera || self.selectedDevice == nil {
                self.chooseCamera()
                return
            }
            self.authorizedStart()
        }
    }
    // Runs on the capture queue; permission alone never chooses another camera.
    private func authorizedStart() {
            self.wanted = true; self.snoozeUntil = nil
            self.report(1)
            self.diagnostic("start authorization=\(AVCaptureDevice.authorizationStatus(for: .video).rawValue)")
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized: self.startSession()
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { allowed in
                    self.queue.async {
                        guard self.wanted else { return }
                        if allowed { self.startSession() } else { self.wanted = false; self.report(4) }
                    }
                }
            default: self.wanted = false; self.report(4)
            }
    }
    private func chooseCamera() {
        selectionPending = true
        generation += 1
        let request = generation
        wanted = false; snoozeUntil = nil; stopSession(); report(11)
        // externalUnknown includes USB/UVC and other external video sources on macOS 14.
        let devices = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .externalUnknown], mediaType: .video, position: .unspecified).devices.filter { $0.isConnected }
        let saved = UserDefaults.standard.string(forKey: cameraKey)
        DispatchQueue.main.async {
            let available = devices.filter { !$0.isSuspended && $0.isConnected }
            var chosen: AVCaptureDevice?
            // A missing remembered camera requires confirmation even with one remaining device.
            if let id = CameraChoice.automaticID(ids: devices.map { $0.uniqueID }, available: Set(available.map { $0.uniqueID }), remembered: saved) {
                chosen = available.first { $0.uniqueID == id }
            } else {
                NSApp.activate(ignoringOtherApps: true)
                let alert = NSAlert()
                alert.messageText = "Welche Kamera möchtest du verwenden?"
                alert.informativeText = available.isEmpty
                    ? "Keine Kamera ist gerade verfügbar. Schließe eine Webcam an oder öffne das MacBook und versuche es erneut."
                    : "Wähle deine Kamera für Tawel. Bei zugeklapptem MacBook bitte die externe Webcam auswählen. Die letzte Auswahl wird vorgemerkt."
                let picker = NSPopUpButton(frame: NSRect(x: 0, y: 0, width: 380, height: 30), pullsDown: false)
                picker.autoenablesItems = false
                for (index, device) in devices.enumerated() {
                    let suffix = device.isSuspended ? " · ruht / nicht verfügbar" : (device.deviceType == .builtInWideAngleCamera ? " · intern" : " · extern")
                    picker.addItem(withTitle: device.localizedName + suffix)
                    picker.lastItem?.tag = index
                    picker.lastItem?.isEnabled = !device.isSuspended && device.isConnected
                }
                if let preferred = available.first(where: { $0.uniqueID == saved }) ?? available.first,
                   let index = devices.firstIndex(where: { $0.uniqueID == preferred.uniqueID }) { picker.selectItem(at: index) }
                alert.accessoryView = picker
                alert.addButton(withTitle: "Kamera verwenden").isEnabled = !available.isEmpty
                alert.addButton(withTitle: "Abbrechen")
                if alert.runModal() == .alertFirstButtonReturn, let item = picker.selectedItem, item.isEnabled {
                    chosen = devices[item.tag]
                }
            }
            let confirmed = chosen
            self.queue.async {
                guard self.generation == request else { return }
                self.selectionPending = false
                guard let device = confirmed, device.isConnected, !device.isSuspended else { self.report(0); return }
                self.session.beginConfiguration()
                for input in self.session.inputs { self.session.removeInput(input) }
                for output in self.session.outputs { self.session.removeOutput(output) }
                self.session.commitConfiguration()
                self.configured = false; self.videoOutput = nil; self.lastDeviceFlags = nil
                self.selectedDevice = device
                self.cameraNameLock.lock(); self.selectedName = device.localizedName; self.cameraNameLock.unlock()
                UserDefaults.standard.set(device.uniqueID, forKey: self.cameraKey)
                self.authorizedStart()
            }
        }
    }
    func reviewJSON() -> String { queue.sync { review.json() } }
    func soundJSON() -> String { queue.sync {
        String(data: (try? JSONEncoder().encode(soundPreferences)) ?? Data(), encoding: .utf8) ?? "{}"
    } }
    func configureSound(enabled: Bool, preset: Int, volume: Double, preview: Bool) {
        queue.async {
            if preview { self.playCue(preset: preset, volume: volume); return }
            if !enabled { NativeAudio.shared.cancel() }
            self.soundPreferences = SoundPreferences(enabled: enabled, preset: max(0,min(4,preset)), volume: max(0,min(1,volume)))
            if let data = try? JSONEncoder().encode(self.soundPreferences) { UserDefaults.standard.set(data, forKey: "tawel.native.sound.v1") }
        }
    }
    func flush() { queue.sync { review.interrupt() } }
    func cameraName() -> String {
        cameraNameLock.lock(); defer { cameraNameLock.unlock() }
        return selectedName
    }
    func pause() { queue.async { self.generation += 1; self.selectionPending = false; self.wanted = false; self.snoozeUntil = nil; self.stopSession(); self.report(3) } }
    func stop() { queue.sync { self.generation += 1; self.selectionPending = false; self.wanted = false; self.snoozeUntil = nil; self.stopSession(); self.report(0) } }
    func snooze(_ seconds: Double) {
        queue.async {
            self.wanted = true; self.snoozeUntil = Date().addingTimeInterval(seconds)
            self.stopSession(); self.report(3)
        }
    }
    func sensitivity(_ radius: Double) { queue.async { self.gate.radius = max(0.15, min(0.5, radius)); self.gate.reset(); self.soundCue = SoundCuePolicy(); NativeAudio.shared.cancel(); self.callback?(20, 0, 0) } }
    private func stopSession() {
        NativeAudio.shared.cancel(); soundCue = SoundCuePolicy()
        _ = preview.read(enabled: false, now: ProcessInfo.processInfo.systemUptime)
        if session.isRunning { session.stopRunning() }
        gate.reset(); callback?(20, 0, 0); callback?(21, 0, 0); review.interrupt()
        if let activity = activity { ProcessInfo.processInfo.endActivity(activity); self.activity = nil }
    }
    private func startSession() {
        guard wanted && !sleeping else { return }
        guard let device = selectedDevice, device.isConnected, !device.isSuspended else {
            report(5); reportCaptureState(); return
        }
        if !configured {
            callback?(14, device.deviceType == .builtInWideAngleCamera ? 1 : 2, 0)
            diagnostic("selected name=\(device.localizedName) type=\(device.deviceType.rawValue) connected=\(device.isConnected) suspended=\(device.isSuspended) transport=\(device.transportType)")
            do {
                let input = try AVCaptureDeviceInput(device: device)
                session.beginConfiguration()
                guard session.canAddInput(input) else { session.commitConfiguration(); wanted = false; report(5); return }
                session.addInput(input)
                let output = AVCaptureVideoDataOutput()
                output.alwaysDiscardsLateVideoFrames = true
                output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
                output.setSampleBufferDelegate(self, queue: queue)
                guard session.canAddOutput(output) else {
                    session.removeInput(input); session.commitConfiguration(); wanted = false; report(5); return
                }
                session.addOutput(output)
                if detail && session.canSetSessionPreset(.hd1280x720) { session.sessionPreset = .hd1280x720 }
                else if session.canSetSessionPreset(.vga640x480) { session.sessionPreset = .vga640x480 }
                else if session.canSetSessionPreset(.medium) { session.sessionPreset = .medium }
                diagnostic("preset=\(session.sessionPreset.rawValue) detail=\(detail) fallback=\(fingerFallback)")
                videoOutput = output
                guard let connection = output.connection(with: .video) else {
                    session.removeOutput(output); session.removeInput(input)
                    videoOutput = nil; session.commitConfiguration()
                    diagnostic("missing_video_connection"); wanted = false; report(10); return
                }
                connection.isEnabled = true
                session.commitConfiguration(); configured = true
                diagnostic("graph inputs=\(session.inputs.count) outputs=\(session.outputs.count) connections=\(output.connections.count) pixel_formats=\(output.availableVideoPixelFormatTypes)")
            } catch { diagnostic("input_error code=\((error as NSError).code) domain=\((error as NSError).domain)"); wanted = false; report(5); return }
        }
        gate.reset(); lastProcessed = -Double.infinity; lastFrameAt = Date()
        analysisAfter = ProcessInfo.processInfo.systemUptime + 5
        announcedActive = false
        callback?(12, 1, 0)
        if activity == nil {
            activity = ProcessInfo.processInfo.beginActivity(options: .userInitiatedAllowingIdleSystemSleep, reason: "Tawel native camera detection")
        }
        session.startRunning()
        report(session.isRunning ? 9 : 6)
        reportCaptureState()
        diagnostic("session running=\(session.isRunning); interruption_status=unsupported_on_macos")
    }

    func captureOutput(_ output: AVCaptureOutput, didDrop sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        callback?(18, 0, 0)
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        callback?(5, 0, 0) // Vor Guards und Vision: echter Delegate-Eingang.
        guard wanted && !sleeping && snoozeUntil == nil else { return }
        let now = ProcessInfo.processInfo.systemUptime
        lastFrameAt = Date()
        guard let image = CMSampleBufferGetImageBuffer(sampleBuffer) else { callback?(12, 6, 0); callback?(4, 0, 0); return }
        // Preview follows the camera, not the analysis cadence: every delegate
        // frame may become a preview (mailbox paces and never overlaps), with the
        // landmarks of the most recent analysis. Vision still runs at most 15/s.
        makePreview(image, now: now)
        guard now >= analysisAfter else { return } // Zuerst nur Kamera messen.
        guard now - lastProcessed >= 1.0 / 15.0 else { return }
        lastProcessed = now
        callback?(31, Double(CVPixelBufferGetWidth(image)), Double(CVPixelBufferGetHeight(image)))
        autoreleasepool {
            do {
                let analysis = try analysisFrame.image(image, detail:detail)
                let prepared = ProcessInfo.processInfo.systemUptime
                callback?(32, (prepared-now)*1000, 0)
                callback?(26, Double(CVPixelBufferGetWidth(analysis)), Double(CVPixelBufferGetHeight(analysis)))
                let handler = VNImageRequestHandler(cvPixelBuffer: analysis, orientation: .up, options: [:])
                callback?(6, 0, 0)
                callback?(12, 2, 0)
                try handler.perform([face])
                let faceFinished = ProcessInfo.processInfo.systemUptime
                callback?(7, 0, 0)
                callback?(12, 3, 0)
                try handler.perform([hands])
                callback?(27, (faceFinished-prepared)*1000, (ProcessInfo.processInfo.systemUptime-faceFinished)*1000)
                callback?(8, 0, 0)
                callback?(12, 4, 0)
                var distance: Double?
                var mouthValid = false, validPoints = 0, fallbackPoints = 0
                if let face = face.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }),
                   let lips = face.landmarks?.outerLips, lips.pointCount > 0, face.boundingBox.width > 0 {
                    mouthValid = true
                    let points = lips.normalizedPoints
                    var center = CGPoint.zero
                    for i in 0..<lips.pointCount { center.x += CGFloat(points[i].x); center.y += CGFloat(points[i].y) }
                    center.x = face.boundingBox.minX + center.x / CGFloat(lips.pointCount) * face.boundingBox.width
                    center.y = face.boundingBox.minY + center.y / CGFloat(lips.pointCount) * face.boundingBox.height
                    let aspect = Double(CVPixelBufferGetHeight(image)) / Double(CVPixelBufferGetWidth(image))
                    for hand in hands.results ?? [] {
                        // Once a moment is active, visible adjacent joints preserve evidence
                        // when the fingertip itself is covered by the mouth.
                        let fingers: [(VNHumanHandPoseObservation.JointName, VNHumanHandPoseObservation.JointName)] = [(.thumbTip,.thumbIP),(.indexTip,.indexDIP),(.middleTip,.middleDIP),(.ringTip,.ringDIP),(.littleTip,.littleDIP)]
                        func measured(_ joint: VNHumanHandPoseObservation.JointName) -> Double? {
                            guard let point = try? hand.recognizedPoint(joint), point.confidence >= 0.3 else { return nil }
                            let dx = Double(point.location.x - center.x)
                            let dy = Double(point.location.y - center.y) * aspect
                            return hypot(dx, dy) / Double(face.boundingBox.width)
                        }
                        for (tip, joint) in fingers {
                            let tipDistance = measured(tip), jointDistance = measured(joint)
                            if let d = DetectionPolicy.distance(tip: tipDistance, adjacent: jointDistance, episode: gate.active, fallback: fingerFallback) {
                                validPoints += 1
                                if tipDistance == nil { fallbackPoints += 1 }
                                distance = min(distance ?? .infinity, d)
                            }
                        }
                    }
                }
                callback?(19, Double(face.results?.count ?? 0), Double(hands.results?.count ?? 0))
                callback?(12, 5, 0)
                callback?(1, distance ?? -1, Double(hands.results?.count ?? 0))
                if !announcedActive { announcedActive = true; report(2) }
                let handVisible = !(hands.results?.isEmpty ?? true)
                let moment = gate.update(distance: distance, now: now, handVisible: handVisible)
                if moment {
                    callback?(2, 0, 0)
                }
                let faceVisible = !(face.results?.isEmpty ?? true)
                review.sample(now: now, date: Date(), valid: faceVisible && !gate.uncertain,
                    quiet: !gate.active && (distance == nil || distance! > gate.radius * 1.35), moment: moment)
                callback?(20, gate.active ? 1 : 0, 0)
                if soundCue.update(visible: gate.active, enabled: soundPreferences.enabled, now: now) {
                    playCue(preset: soundPreferences.preset, volume: soundPreferences.volume)
                }
                // Missing hands are normal. Only missing mouth/low-confidence hands need guidance.
                let tracking = !mouthValid ? 1 : (!handVisible ? 0 : (distance == nil ? 2 : 0))
                callback?(21, gate.uncertain || tracking != 0 ? 1 : 0, Double(tracking))
                let reason = !mouthValid ? 1 : (!handVisible ? 2 : (distance == nil ? 3 : (gate.active ? 6 : (distance! > gate.radius ? 4 : 5))))
                callback?(33, Double(reason), Double(gate.phase))
                callback?(34, Double(validPoints), Double(fallbackPoints))
                callback?(22, (ProcessInfo.processInfo.systemUptime - now) * 1000, 0)
            } catch {
                _ = gate.update(distance: nil, now: now)
                callback?(20, gate.active ? 1 : 0, 0); callback?(21, 1, 3)
                callback?(33, 7, Double(gate.phase))
                _ = soundCue.update(visible: gate.active, enabled: false, now: now)
                review.interrupt(); callback?(4, 0, 0)
                callback?(22, (ProcessInfo.processInfo.systemUptime - now) * 1000, 0)
            }
        }
    }
}

@_cdecl("tawel_native_register")
public func tawelNativeRegister(_ cb: @escaping @convention(c) (Int32, Double, Double) -> Void) { NativeEngine.shared.setCallback(cb) }
@_cdecl("tawel_native_start") public func tawelNativeStart() { NativeEngine.shared.start() }
@_cdecl("tawel_native_quality") public func tawelNativeQuality(_ detail: Int32, _ fallback: Int32) { NativeEngine.shared.quality(detail: detail != 0, fallback: fallback != 0) }
@_cdecl("tawel_native_choose_camera") public func tawelNativeChooseCamera() { NativeEngine.shared.start(chooseCamera: true) }
@_cdecl("tawel_native_camera_name") public func tawelNativeCameraName() -> UnsafeMutablePointer<CChar>? { strdup(NativeEngine.shared.cameraName()) }
@_cdecl("tawel_native_free_string") public func tawelNativeFreeString(_ pointer: UnsafeMutablePointer<CChar>?) { free(pointer) }
@_cdecl("tawel_native_pause") public func tawelNativePause() { NativeEngine.shared.pause() }
@_cdecl("tawel_native_stop") public func tawelNativeStop() { NativeEngine.shared.stop() }
@_cdecl("tawel_native_snooze") public func tawelNativeSnooze(_ seconds: Double) { NativeEngine.shared.snooze(seconds) }
@_cdecl("tawel_native_sensitivity") public func tawelNativeSensitivity(_ radius: Double) { NativeEngine.shared.sensitivity(radius) }

@_cdecl("tawel_native_review") public func tawelNativeReview() -> UnsafeMutablePointer<CChar>? { strdup(NativeEngine.shared.reviewJSON()) }
@_cdecl("tawel_native_sound_settings") public func tawelNativeSoundSettings() -> UnsafeMutablePointer<CChar>? { strdup(NativeEngine.shared.soundJSON()) }
@_cdecl("tawel_native_sound") public func tawelNativeSound(_ enabled: Int32, _ preset: Int32, _ volume: Double, _ preview: Int32) { NativeEngine.shared.configureSound(enabled: enabled != 0, preset: Int(preset), volume: volume, preview: preview != 0) }
@_cdecl("tawel_native_flush") public func tawelNativeFlush() { NativeEngine.shared.flush() }
@_cdecl("tawel_background_notice") public func tawelBackgroundNotice() {
    DispatchQueue.main.async {
        let key = "tawel.background.explained.v1"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)
        let alert = NSAlert(); alert.messageText = "Tawel bleibt geöffnet."
        alert.informativeText = "Das Fenster wird ausgeblendet. Eine laufende Erkennung bleibt aktiv. Über den Ring in der Menüleiste öffnest du Tawel wieder. Mit ‚Tawel beenden‘ oder ⌘Q beendest du die App vollständig."
        alert.addButton(withTitle: "Verstanden"); alert.runModal()
    }
}

@_cdecl("tawel_native_preview") public func tawelNativePreview(_ enabled: Int32) -> UnsafeMutablePointer<CChar>? { strdup(NativeEngine.shared.previewJSON(enabled: enabled != 0)) }
