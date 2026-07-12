locals {
  name_prefix = "${var.service_name}-${var.environment}"

  artifact_registry_repository_id  = "${local.name_prefix}-containers"
  github_actions_service_account   = "${local.name_prefix}-gha-publisher"
  github_workload_identity_pool_id = "${local.name_prefix}-github"

  common_labels = {
    app         = var.service_name
    environment = var.environment
    managed_by  = "terraform"
  }

  required_services = toset([
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
  ])
}
