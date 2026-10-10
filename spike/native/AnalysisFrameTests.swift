import Foundation
import CoreImage
import CoreVideo
@main struct AnalysisFrameTests {
    static func main() throws {
        var source: CVPixelBuffer?
        let attrs: [CFString:Any] = [kCVPixelBufferIOSurfacePropertiesKey:[:]]
        assert(CVPixelBufferCreate(kCFAllocatorDefault,1920,1080,kCVPixelFormatType_32BGRA,attrs as CFDictionary,&source) == kCVReturnSuccess)
        let left = CIImage(color:CIColor(red:1,green:0,blue:0)).cropped(to:CGRect(x:0,y:0,width:960,height:1080))
        let right = CIImage(color:CIColor(red:0,green:0,blue:1)).cropped(to:CGRect(x:960,y:0,width:960,height:1080))
        let context = CIContext(options:[.useSoftwareRenderer:true])
        context.render(left.composited(over:right),to:source!)
        let frame = AnalysisFrame()
        for detail in [true,false,true] {
            let output = try frame.image(source!,detail:detail)
            let w=CVPixelBufferGetWidth(output), h=CVPixelBufferGetHeight(output)
            assert(w == (detail ? 1280 : 640) && h == (detail ? 720 : 360))
            CVPixelBufferLockBaseAddress(output,.readOnly)
            let bytes=CVPixelBufferGetBaseAddress(output)!.assumingMemoryBound(to:UInt8.self)
            let row=(h/2)*CVPixelBufferGetBytesPerRow(output)
            assert(bytes[row+(w/4)*4+2] > 200 && bytes[row+(w/4)*4] < 20, "Left red remains on left")
            assert(bytes[row+(3*w/4)*4] > 200 && bytes[row+(3*w/4)*4+2] < 20, "Right blue remains on right")
            CVPixelBufferUnlockBaseAddress(output,.readOnly)
        }
        print("Analysis frame dimensions and image alignment: ok")
    }
}
