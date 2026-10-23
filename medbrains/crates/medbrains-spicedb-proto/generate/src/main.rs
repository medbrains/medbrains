//! Generates the SpiceDB client from the official authzed/api protos.
//! Usage: spicedb-proto-gen <proto-root> <out-dir>
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let root = PathBuf::from(args.next().ok_or("proto root")?);
    let out = PathBuf::from(args.next().ok_or("out dir")?);
    let files: Vec<PathBuf> = [
        "authzed/api/v1/permission_service.proto",
        "authzed/api/v1/schema_service.proto",
        "authzed/api/v1/watch_service.proto",
        "google/rpc/status.proto",
    ]
    .iter()
    .map(|f| root.join(f))
    .collect();
    tonic_prost_build::configure()
        .build_server(false)
        .out_dir(&out)
        .compile_protos(&files, &[root])?;
    Ok(())
}
