import AppKit
import AVFoundation
import Vision
import CoreMedia

private typealias NativeCallback = @convention(c) (Int32, Double, Double) -> Void
private final class NativeEngine: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    static let shared = NativeEngine()
    private let queue = DispatchQueue(label: "app.tawel.native-capture")
    private let session = AVCaptureSession()
    private var callback: NativeCallback?
    private var lastDeviceFlags: Int?
    private var selectedDevice: AVCaptureDevice?
    private var selectionPending = false
    private var generation = 0
    private let cameraKey = "tawel.native.camera.v1"
    private var videoOutput: AVCaptureVideoDataOutput?
    private var configured = false
    private var wanted = false
    private var sleeping = false
    private var snoozeUntil: Date?
    private var gate = ProximityGate()
    private var analysisAfter = 0.0
    private var announcedActive = false
    private var lastProcessed = -Double.infinity
    private var lastFrameAt = Date()
    private var lastRestart = Date.distantPast
    private var activity: NSObjectProtocol?
    private var observers: [NSObjectProtocol] = []
    private var watchdog: DispatchSourceTimer?
    private let face = VNDetectFaceLandmarksRequest()
    private let hands = VNDetectHumanHandPoseRequest()

    override init() {
        super.init()
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
                UserDefaults.standard.set(device.uniqueID, forKey: self.cameraKey)
                self.authorizedStart()
            }
        }
    }
    func cameraName() -> String { queue.sync { selectedDevice?.localizedName ?? "Noch keine Kamera gewählt" } }
    func pause() { queue.async { self.generation += 1; self.selectionPending = false; self.wanted = false; self.snoozeUntil = nil; self.stopSession(); self.report(3) } }
    func stop() { queue.sync { self.generation += 1; self.selectionPending = false; self.wanted = false; self.snoozeUntil = nil; self.stopSession(); self.report(0) } }
    func snooze(_ seconds: Double) {
        queue.async {
            self.wanted = true; self.snoozeUntil = Date().addingTimeInterval(seconds)
            self.stopSession(); self.report(3)
        }
    }
    func sensitivity(_ radius: Double) { queue.async { self.gate.radius = max(0.15, min(0.5, radius)); self.gate.reset() } }
    private func stopSession() {
        if session.isRunning { session.stopRunning() }
        gate.reset()
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
                if session.canSetSessionPreset(.vga640x480) { session.sessionPreset = .vga640x480 }
                else if session.canSetSessionPreset(.high) { session.sessionPreset = .high }
                diagnostic("preset=\(session.sessionPreset.rawValue)")
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
        guard now >= analysisAfter else { return } // Zuerst nur Kamera messen.
        guard now - lastProcessed >= 1.0 / 15.0 else { return }
        lastProcessed = now
        guard let image = CMSampleBufferGetImageBuffer(sampleBuffer) else { callback?(12, 6, 0); callback?(4, 0, 0); return }
        autoreleasepool {
            do {
                let handler = VNImageRequestHandler(cvPixelBuffer: image, orientation: .up, options: [:])
                callback?(6, 0, 0)
                callback?(12, 2, 0)
                try handler.perform([face])
                callback?(7, 0, 0)
                callback?(12, 3, 0)
                try handler.perform([hands])
                callback?(8, 0, 0)
                callback?(12, 4, 0)
                var distance: Double?
                if let face = face.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }),
                   let lips = face.landmarks?.outerLips, lips.pointCount > 0, face.boundingBox.width > 0 {
                    let points = lips.normalizedPoints
                    var center = CGPoint.zero
                    for i in 0..<lips.pointCount { center.x += CGFloat(points[i].x); center.y += CGFloat(points[i].y) }
                    center.x = face.boundingBox.minX + center.x / CGFloat(lips.pointCount) * face.boundingBox.width
                    center.y = face.boundingBox.minY + center.y / CGFloat(lips.pointCount) * face.boundingBox.height
                    let aspect = Double(CVPixelBufferGetHeight(image)) / Double(CVPixelBufferGetWidth(image))
                    for hand in hands.results ?? [] {
                        let tips: [VNHumanHandPoseObservation.JointName] = [.thumbTip, .indexTip, .middleTip, .ringTip, .littleTip]
                        for tip in tips {
                            let point = try hand.recognizedPoint(tip)
                            guard point.confidence >= 0.3 else { continue }
                            let dx = Double(point.location.x - center.x)
                            let dy = Double(point.location.y - center.y) * aspect
                            let d = hypot(dx, dy) / Double(face.boundingBox.width)
                            distance = min(distance ?? .infinity, d)
                        }
                    }
                }
                callback?(19, Double(face.results?.count ?? 0), Double(hands.results?.count ?? 0))
                callback?(12, 5, 0)
                callback?(1, distance ?? -1, Double(hands.results?.count ?? 0))
                if !announcedActive { announcedActive = true; report(2) }
                if gate.update(distance: distance, now: now) { callback?(2, 0, 0) }
            } catch { gate.reset(); callback?(4, 0, 0) }
        }
    }
}

@_cdecl("tawel_native_register")
public func tawelNativeRegister(_ cb: @escaping @convention(c) (Int32, Double, Double) -> Void) { NativeEngine.shared.setCallback(cb) }
@_cdecl("tawel_native_start") public func tawelNativeStart() { NativeEngine.shared.start() }
@_cdecl("tawel_native_choose_camera") public func tawelNativeChooseCamera() { NativeEngine.shared.start(chooseCamera: true) }
@_cdecl("tawel_native_camera_name") public func tawelNativeCameraName() -> UnsafeMutablePointer<CChar>? { strdup(NativeEngine.shared.cameraName()) }
@_cdecl("tawel_native_free_string") public func tawelNativeFreeString(_ pointer: UnsafeMutablePointer<CChar>?) { free(pointer) }
@_cdecl("tawel_native_pause") public func tawelNativePause() { NativeEngine.shared.pause() }
@_cdecl("tawel_native_stop") public func tawelNativeStop() { NativeEngine.shared.stop() }
@_cdecl("tawel_native_snooze") public func tawelNativeSnooze(_ seconds: Double) { NativeEngine.shared.snooze(seconds) }
@_cdecl("tawel_native_sensitivity") public func tawelNativeSensitivity(_ radius: Double) { NativeEngine.shared.sensitivity(radius) }
