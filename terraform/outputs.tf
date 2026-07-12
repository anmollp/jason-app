output "name_prefix" {
  description = "Shared resource name prefix."
  value       = local.name_prefix
}

output "common_labels" {
  description = "Labels that should be applied to all supported resources."
  value       = local.common_labels
}

output "artifact_registry_repository" {
  description = "Artifact Registry Docker repository name."
  value       = google_artifact_registry_repository.containers.name
}

output "artifact_registry_repository_id" {
  description = "Artifact Registry Docker repository ID."
  value       = google_artifact_registry_repository.containers.repository_id
}

output "frontend_service_url" {
  description = "Public frontend Cloud Run URL."
  value       = google_cloud_run_v2_service.frontend.uri
}

output "backend_service_url" {
  description = "Public backend Cloud Run URL."
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_service_account_email" {
  description = "Frontend Cloud Run runtime service account email."
  value       = google_service_account.frontend.email
}

output "backend_service_account_email" {
  description = "Backend Cloud Run runtime service account email."
  value       = google_service_account.backend.email
}

output "github_actions_service_account_email" {
  description = "GitHub Actions image publisher service account email."
  value       = google_service_account.github_actions_publisher.email
}

output "github_actions_workload_identity_provider" {
  description = "Workload Identity provider resource name for GitHub Actions."
  value       = google_iam_workload_identity_pool_provider.github_actions.name
}
