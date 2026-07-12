locals {
  name_prefix = "${var.service_name}-${var.environment}"

  artifact_registry_repository_id  = "${local.name_prefix}-containers"
  github_actions_deploy_account    = "${local.name_prefix}-gha-deploy"
  github_actions_service_account   = "${local.name_prefix}-gha-publisher"
  github_workload_identity_pool_id = "${local.name_prefix}-github"
  create_budget_alert              = var.billing_account_id != ""

  common_labels = {
    app         = var.service_name
    environment = var.environment
    managed_by  = "terraform"
  }

  required_services = toset([
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
  ])

  github_actions_deploy_project_roles = toset([
    "roles/artifactregistry.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountUser",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/run.admin",
    "roles/serviceusage.serviceUsageAdmin",
  ])
}
