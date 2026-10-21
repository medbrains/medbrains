# ── Static assets CDN: the body-site picker's 3D anatomy model ──
# ~33 MB, too heavy to ship in every web build, so one S3 bucket behind
# CloudFront serves it to every hospital. Upload a pinned version with
#   python3 scripts/sync_anatomy_atlas.py --upload s3://<bucket>/anatomy/<version>
# The web build points VITE_ANATOMY_BASE_URL at <origin>/anatomy/<version>;
# the server's CSP needs ANATOMY_CDN_ORIGIN = <origin>.

module "static_assets" {
  source          = "../../modules/static-assets"
  environment     = "prod"
  region          = var.company_region
  allowed_origins = ["https://app.${var.company_domain}"]
}

output "static_assets_bucket" {
  value = module.static_assets.bucket
}

output "static_assets_origin" {
  value = module.static_assets.origin
}
