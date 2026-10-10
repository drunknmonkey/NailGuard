import Foundation
import CoreImage
import CoreVideo

// Owned by the serial capture queue. Vision finishes before the buffer is reused.
final class AnalysisFrame {
    private let analysisContext = CIContext(options: [.cacheIntermediates: false, .useSoftwareRenderer: true])
    private var analysisBuffer: CVPixelBuffer?
    func image(_ source: CVPixelBuffer, detail: Bool) throws -> CVPixelBuffer {
        let w = CVPixelBufferGetWidth(source), h = CVPixelBufferGetHeight(source)
        let (width,height) = AnalysisGeometry.size(width:w,height:h,detail:detail)
        if width == w && height == h { return source }
        if analysisBuffer == nil || CVPixelBufferGetWidth(analysisBuffer!) != width || CVPixelBufferGetHeight(analysisBuffer!) != height {
            analysisBuffer = nil
            let attrs: [CFString: Any] = [kCVPixelBufferCGImageCompatibilityKey:true, kCVPixelBufferCGBitmapContextCompatibilityKey:true, kCVPixelBufferIOSurfacePropertiesKey:[:]]
            guard CVPixelBufferCreate(kCFAllocatorDefault,width,height,kCVPixelFormatType_32BGRA,attrs as CFDictionary,&analysisBuffer) == kCVReturnSuccess else {
                throw NSError(domain:"TawelAnalysis",code:1)
            }
        }
        guard let target = analysisBuffer else { throw NSError(domain:"TawelAnalysis",code:2) }
        let scaled = CIImage(cvPixelBuffer:source).transformed(by:CGAffineTransform(scaleX:Double(width)/Double(w),y:Double(height)/Double(h)))
        analysisContext.render(scaled,to:target,bounds:CGRect(x:0,y:0,width:CGFloat(width),height:CGFloat(height)),colorSpace:CGColorSpaceCreateDeviceRGB())
        return target
    }
}
