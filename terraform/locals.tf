locals {
  name_prefix = "${var.service_name}-${var.environment}"

  artifact_registry_repository_id = "${local.name_prefix}-containers"

  common_labels = {
    app         = var.service_name
    environment = var.environment
    managed_by  = "terraform"
  }

  required_services = toset([
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
  ])
}
