#![forbid(unsafe_code)]

fn main() {
    if let Err(error) = vc_classic_video_games::run() {
        eprintln!("VC Classic Video Games failed to initialize: {error}");
        std::process::exit(1);
    }
}
