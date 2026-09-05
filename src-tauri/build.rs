fn main() {
    println!("cargo:rerun-if-changed=../spike/native/NativeEngine.swift");
    println!("cargo:rerun-if-changed=../spike/native/ProximityGate.swift");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        use std::process::Command;
        let out = std::env::var("OUT_DIR").unwrap();
        let swift = Command::new("xcrun").args(["--find", "swiftc"]).output().unwrap();
        assert!(swift.status.success());
        let swift = String::from_utf8(swift.stdout).unwrap().trim().to_string();
        let sdk = Command::new("xcrun").args(["--sdk", "macosx", "--show-sdk-path"]).output().unwrap();
        assert!(sdk.status.success());
        let sdk = String::from_utf8(sdk.stdout).unwrap().trim().to_string();
        let arch = if std::env::var("CARGO_CFG_TARGET_ARCH").unwrap() == "aarch64" { "arm64" } else { "x86_64" };
        let status = Command::new(&swift).args([
            "-parse-as-library", "-emit-library", "-static", "-O", "-module-name", "TawelNative",
            "-target", &format!("{arch}-apple-macosx14.0"),
            "-sdk", &sdk,
            "../spike/native/ProximityGate.swift", "../spike/native/NativeEngine.swift",
            "-o", &format!("{out}/libTawelNative.a"),
        ]).status().unwrap();
        assert!(status.success(), "Native Swift engine failed to compile");
        let runtime = std::path::Path::new(&swift).parent().unwrap().parent().unwrap().join("lib/swift/macosx");
        println!("cargo:rustc-link-search=native={out}");
        println!("cargo:rustc-link-search=native={}", runtime.display());
        println!("cargo:rustc-link-search=native={sdk}/usr/lib/swift");
        println!("cargo:rustc-link-search=native=/usr/lib/swift");
        println!("cargo:rustc-link-lib=static=TawelNative");
        println!("cargo:rustc-link-lib=dylib=swiftCore");
        for framework in ["Foundation", "AppKit", "AVFoundation", "Vision", "CoreMedia", "CoreVideo"] {
            println!("cargo:rustc-link-lib=framework={framework}");
        }
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
    }
    tauri_build::build()
}
