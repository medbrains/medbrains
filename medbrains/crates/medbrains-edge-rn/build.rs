fn main() {
    uniffi::generate_scaffolding("./src/edge_rn.udl").expect("uniffi scaffolding");
}
