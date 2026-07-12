resource "google_iam_workload_identity_pool" "github_actions" {
  project                   = var.project_id
  workload_identity_pool_id = local.github_workload_identity_pool_id
  display_name              = "Jason ${var.environment} GitHub"
  description               = "GitHub Actions identities for Jason ${var.environment}."

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}

resource "google_iam_workload_identity_pool_provider" "github_actions" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub Actions"
  description                        = "OIDC provider for ${var.github_repository} GitHub Actions."

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == \"${var.github_repository}\" && assertion.ref == \"${var.github_ref}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_actions_publisher_impersonation" {
  service_account_id = google_service_account.github_actions_publisher.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_actions.name}/attribute.repository/${var.github_repository}"
}

resource "google_service_account_iam_member" "github_actions_deployer_impersonation" {
  service_account_id = google_service_account.github_actions_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_actions.name}/attribute.repository/${var.github_repository}"
}

resource "google_artifact_registry_repository_iam_member" "github_actions_publisher_writer" {
  project    = var.project_id
  location   = google_artifact_registry_repository.containers.location
  repository = google_artifact_registry_repository.containers.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.github_actions_publisher.email}"
}

resource "google_project_iam_member" "github_actions_deployer_project_roles" {
  for_each = local.github_actions_deploy_project_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_actions_deployer.email}"
}

resource "google_billing_account_iam_member" "github_actions_deployer_budget_manager" {
  count = local.create_budget_alert ? 1 : 0

  billing_account_id = var.billing_account_id
  role               = "roles/billing.costsManager"
  member             = "serviceAccount:${google_service_account.github_actions_deployer.email}"
}
