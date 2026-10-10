import AppKit
import QuartzCore

// Native visual cue (MAC-0.1.32). A borderless, click-through, non-activating
// panel above everything else. Every effect is a Core Animation layer, and one
// cue is ONE keyframe animation (fade in → hold → fade out) committed once; it
// then runs on the render server with the same duration and curve every time,
// whatever the app, the WebView or the detection are doing. Behind-window blur
// uses the QuartzCore backdrop layer WebKit and NSVisualEffectView use
// internally; when it is unavailable the blur styles fall back to their veil.
final class NativeCue: NSObject {
    static let shared = NativeCue()
    typealias Callback = @convention(c) (Int32, Double, Double) -> Void
    // Stages reported to the host: 1 show (aux: backdrop 1/0), 2 committed (aux: total ms),
    // 3 complete (aux: elapsed ms), 4 hidden, 5 superseded, 6 unavailable, 7 safety net.
    private var callback: Callback?
    private var panel: NSPanel?
    private var revision: UInt64 = 0
    private var startedAt = 0.0
    private var animated: [CALayer] = []
    private let probe = CALayer()
    private var safety: DispatchWorkItem?

    private static let backdropClass = NSClassFromString("CABackdropLayer") as? CALayer.Type
    private static let filterClass = NSClassFromString("CAFilter") as? NSObject.Type
    static var backdropAvailable: Bool { backdropClass != nil && filterClass != nil }

    private static let lavender = (143.0 / 255, 122.0 / 255, 174.0 / 255)
    private static let lavenderSoft = (190.0 / 255, 174.0 / 255, 214.0 / 255)
    private static let petrol = (74.0 / 255, 132.0 / 255, 126.0 / 255)
    private static let paper = (250.0 / 255, 252.0 / 255, 250.0 / 255)

    func register(_ value: @escaping Callback) { callback = value }
    private func report(_ stage: Int32, _ aux: Double) { callback?(stage, Double(revision), aux) }

    func show(style: Int, intensity: Int, blur: Double, fadeInMs: Double, holdMs: Double, fadeOutMs: Double, revision: UInt64) {
        let recipe = CueRecipe.make(style: style, intensity: intensity, blur: blur)
        let work = { [self] in
            let reduce = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
            let timeline = CueTimeline(fadeIn: fadeInMs / 1000, hold: holdMs / 1000, fadeOut: fadeOutMs / 1000, reduceMotion: reduce)
            present(recipe, timeline, revision)
        }
        if Thread.isMainThread { work() } else { DispatchQueue.main.async(execute: work) }
    }

    func cancel() {
        let work = { [self] in if panel?.isVisible == true { finish(revision, stage: 3) } }
        if Thread.isMainThread { work() } else { DispatchQueue.main.async(execute: work) }
    }

    // MARK: - Presentation (main thread)

    private func present(_ recipe: CueRecipe, _ timeline: CueTimeline, _ token: UInt64) {
        revision = token
        let panel = self.panel ?? makePanel()
        self.panel = panel
        guard let screen = targetScreen(), let host = panel.contentView?.layer else { report(6, 0); return }
        safety?.cancel(); safety = nil
        let wasVisible = panel.isVisible
        // A cue arriving while one is still visible continues from the current level.
        let start = wasVisible ? Double(probe.presentation()?.opacity ?? 0) : 0
        for layer in animated { layer.removeAllAnimations() }
        animated.removeAll()
        host.sublayers?.forEach { $0.removeFromSuperlayer() }
        panel.setFrame(screen.frame, display: false)
        let bounds = CGRect(origin: .zero, size: screen.frame.size)
        let properties = build(recipe, in: host, bounds: bounds)
        report(1, Self.backdropAvailable ? 1 : 0)
        if !wasVisible { panel.orderFrontRegardless() }
        startedAt = CACurrentMediaTime()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        CATransaction.setCompletionBlock { [weak self] in self?.finish(token, stage: 3) }
        for property in properties {
            let values = timeline.values(from: property.floor + (property.peak - property.floor) * start, peak: property.peak, end: property.floor)
            animate(property.layer, keyPath: property.keyPath, values: values, timeline: timeline)
        }
        CATransaction.commit()
        report(2, timeline.total * 1000)
        let item = DispatchWorkItem { [weak self] in self?.finish(token, stage: 7) }
        safety = item
        DispatchQueue.main.asyncAfter(deadline: .now() + timeline.total + 0.5, execute: item)
    }

    private func finish(_ token: UInt64, stage: Int32) {
        guard token == revision else { report(5, 0); return }
        guard let panel = panel, panel.isVisible else { return }
        safety?.cancel(); safety = nil
        report(stage, (CACurrentMediaTime() - startedAt) * 1000)
        panel.orderOut(nil)
        for layer in animated { layer.removeAllAnimations() }
        animated.removeAll()
        panel.contentView?.layer?.sublayers?.forEach { $0.removeFromSuperlayer() }
        report(4, 0)
    }

    private func animate(_ layer: CALayer, keyPath: String, values: [Double], timeline: CueTimeline) {
        // Model value is the end value, so nothing snaps when the animation is removed.
        layer.setValue(values.last, forKeyPath: keyPath)
        let animation = CAKeyframeAnimation(keyPath: keyPath)
        animation.values = values.map { NSNumber(value: $0) }
        animation.keyTimes = timeline.keyTimes.map { NSNumber(value: $0) }
        let ease = CAMediaTimingFunction(name: .easeInEaseOut)
        animation.timingFunctions = [ease, CAMediaTimingFunction(name: .linear), ease]
        animation.duration = timeline.total
        animation.fillMode = .forwards
        animation.isRemovedOnCompletion = false
        layer.add(animation, forKey: "cue")
        animated.append(layer)
    }

    private struct Property { let layer: CALayer; let keyPath: String; let floor: Double; let peak: Double }

    /// Builds the layer tree for a recipe and returns the properties to animate.
    private func build(_ recipe: CueRecipe, in host: CALayer, bounds: CGRect) -> [Property] {
        var properties: [Property] = []
        func add(_ layer: CALayer, keyPath: String = "opacity", floor: Double = 0, peak: Double = 1) {
            layer.frame = bounds
            host.addSublayer(layer)
            properties.append(Property(layer: layer, keyPath: keyPath, floor: floor, peak: peak))
        }
        probe.opacity = 0
        add(probe)
        switch recipe.style {
        case .vignette:
            add(image(bounds) { ctx, rect in
                Self.radial(ctx, center: CGPoint(x: rect.midX, y: rect.midY), rx: rect.width / CGFloat(2).squareRoot(), ry: rect.height / CGFloat(2).squareRoot(), stops: [
                    (0, Self.color(Self.lavender, 0)), (0.48, Self.color(Self.lavender, 0)), (0.61, Self.color(Self.lavenderSoft, 0.025)),
                    (0.82, Self.color(Self.lavender, recipe.vignetteMid)), (1, Self.color(Self.lavender, recipe.vignetteEdge))])
            })
        case .ambientGlow:
            add(image(bounds) { ctx, rect in
                let w = rect.width, h = rect.height, k = CGFloat(2).squareRoot()
                Self.radial(ctx, center: CGPoint(x: 0, y: h * 0.72), rx: w * k, ry: h * 0.72 * k, stops: [(0, Self.color(Self.lavender, recipe.ambientAlpha)), (0.45, Self.color(Self.lavender, 0))])
                Self.radial(ctx, center: CGPoint(x: w, y: h * 0.28), rx: w * k, ry: h * 0.72 * k, stops: [(0, Self.color(Self.petrol, recipe.ambientPetrolAlpha)), (0.45, Self.color(Self.petrol, 0))])
                Self.radial(ctx, center: CGPoint(x: rect.midX, y: rect.midY), rx: w / k, ry: h / k, stops: [(0, Self.color(Self.lavenderSoft, 0)), (0.66, Self.color(Self.lavenderSoft, 0)), (1, Self.color(Self.lavenderSoft, recipe.ambientEdgeAlpha))])
            })
        case .softFocus:
            if let (layer, keyPath) = backdrop(type: "gaussianBlur", name: "blur", key: "inputRadius", initial: 0) {
                add(layer, keyPath: keyPath, floor: 0, peak: recipe.blurRadius)
            }
            add(solid(Self.paper, recipe.focusVeil))
        case .desaturate:
            if let (layer, keyPath) = backdrop(type: "colorSaturate", name: "sat", key: "inputAmount", initial: 1) {
                add(layer, keyPath: keyPath, floor: 1, peak: recipe.saturationMin)
            }
            add(solid(Self.paper, recipe.desaturateVeil))
        case .washFocus:
            add(solid(Self.lavenderSoft, recipe.comboColorAlpha))
            if let (layer, keyPath) = backdrop(type: "gaussianBlur", name: "blur", key: "inputRadius", initial: 0) {
                add(layer, keyPath: keyPath, floor: 0, peak: recipe.blurRadius)
            }
            add(solid(Self.paper, recipe.comboVeil))
        }
        return properties
    }

    // MARK: - Layers

    private func solid(_ rgb: (Double, Double, Double), _ alpha: Double) -> CALayer {
        let layer = CALayer()
        layer.backgroundColor = Self.color(rgb, alpha)
        layer.opacity = 0
        return layer
    }

    private func image(_ bounds: CGRect, _ draw: (CGContext, CGRect) -> Void) -> CALayer {
        let layer = CALayer()
        layer.opacity = 0
        layer.contentsScale = 1
        layer.contentsGravity = .resize
        let w = max(1, Int(bounds.width.rounded(.up))), h = max(1, Int(bounds.height.rounded(.up)))
        if let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                               bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) {
            draw(ctx, CGRect(x: 0, y: 0, width: CGFloat(w), height: CGFloat(h)))
            layer.contents = ctx.makeImage()
        }
        return layer
    }

    private func backdrop(type: String, name: String, key: String, initial: Double) -> (CALayer, String)? {
        guard let cls = Self.backdropClass, let filterClass = Self.filterClass,
              let filter = filterClass.perform(NSSelectorFromString("filterWithType:"), with: type)?.takeUnretainedValue() as? NSObject
        else { return nil }
        filter.setValue(name, forKey: "name")
        filter.setValue(initial, forKey: key)
        let layer = cls.init()
        layer.filters = [filter]
        // Blur what is behind the window, not only this (empty) layer tree.
        if layer.responds(to: NSSelectorFromString("setWindowServerAware:")) { layer.setValue(true, forKey: "windowServerAware") }
        return (layer, "filters.\(name).\(key)")
    }

    private static func color(_ rgb: (Double, Double, Double), _ alpha: Double) -> CGColor {
        CGColor(colorSpace: CGColorSpaceCreateDeviceRGB(), components: [CGFloat(rgb.0), CGFloat(rgb.1), CGFloat(rgb.2), CGFloat(alpha)]) ?? CGColor(gray: 0, alpha: 0)
    }

    private static func radial(_ ctx: CGContext, center: CGPoint, rx: CGFloat, ry: CGFloat, stops: [(CGFloat, CGColor)]) {
        guard rx > 0, ry > 0,
              let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: stops.map { $0.1 } as CFArray, locations: stops.map { $0.0 })
        else { return }
        ctx.saveGState()
        ctx.translateBy(x: center.x, y: center.y)
        ctx.scaleBy(x: 1, y: ry / rx)
        ctx.drawRadialGradient(gradient, startCenter: .zero, startRadius: 0, endCenter: .zero, endRadius: rx, options: [.drawsAfterEndLocation])
        ctx.restoreGState()
    }

    // MARK: - Window

    private func makePanel() -> NSPanel {
        let frame = NSScreen.main?.frame ?? CGRect(x: 0, y: 0, width: 1280, height: 800)
        let panel = NSPanel(contentRect: frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.ignoresMouseEvents = true
        panel.level = .screenSaver
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        panel.sharingType = .none
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.animationBehavior = .none
        panel.isFloatingPanel = true
        let view = NSView(frame: CGRect(origin: .zero, size: frame.size))
        view.wantsLayer = true
        view.layerContentsRedrawPolicy = .never
        panel.contentView = view
        return panel
    }

    private func targetScreen() -> NSScreen? {
        let mouse = NSEvent.mouseLocation
        return NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) } ?? NSScreen.main ?? NSScreen.screens.first
    }
}

@_cdecl("tawel_native_cue_register")
public func tawelNativeCueRegister(_ callback: @escaping @convention(c) (Int32, Double, Double) -> Void) { NativeCue.shared.register(callback) }
@_cdecl("tawel_native_cue_show")
public func tawelNativeCueShow(_ style: Int32, _ intensity: Int32, _ blur: Double, _ fadeInMs: Double, _ holdMs: Double, _ fadeOutMs: Double, _ revision: Double) {
    NativeCue.shared.show(style: Int(style), intensity: Int(intensity), blur: blur, fadeInMs: fadeInMs, holdMs: holdMs, fadeOutMs: fadeOutMs, revision: UInt64(max(0, revision)))
}
@_cdecl("tawel_native_cue_cancel") public func tawelNativeCueCancel() { NativeCue.shared.cancel() }
@_cdecl("tawel_native_cue_available") public func tawelNativeCueAvailable() -> Int32 { NativeCue.backdropAvailable ? 1 : 0 }
