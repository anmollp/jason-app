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

resource "google_service_account" "github_actions_publisher" {
  project      = var.project_id
  account_id   = local.github_actions_service_account
  display_name = "Jason ${var.environment} GitHub Actions image publisher"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}

resource "google_service_account" "github_actions_deployer" {
  project      = var.project_id
  account_id   = local.github_actions_deploy_account
  display_name = "Jason ${var.environment} GitHub Actions Terraform deployer"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}
