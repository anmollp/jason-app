resource "google_service_account" "frontend" {
  project      = var.project_id
  account_id   = "${local.name_prefix}-frontend"
  display_name = "Jason ${var.environment} frontend Cloud Run"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}

resource "google_service_account" "backend" {
  project      = var.project_id
  account_id   = "${local.name_prefix}-backend"
  display_name = "Jason ${var.environment} backend Cloud Run"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}
