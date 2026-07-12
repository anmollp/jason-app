output "artifact_registry_repository" {
  description = "Artifact Registry Docker repository name."
  value       = module.jason.artifact_registry_repository
}

output "frontend_service_url" {
  description = "Public frontend Cloud Run URL."
  value       = module.jason.frontend_service_url
}

output "backend_service_url" {
  description = "Public backend Cloud Run URL."
  value       = module.jason.backend_service_url
}

output "frontend_service_account_email" {
  description = "Frontend Cloud Run runtime service account email."
  value       = module.jason.frontend_service_account_email
}

output "backend_service_account_email" {
  description = "Backend Cloud Run runtime service account email."
  value       = module.jason.backend_service_account_email
}

output "github_actions_service_account_email" {
  description = "GitHub Actions image publisher service account email."
  value       = module.jason.github_actions_service_account_email
}

output "github_actions_deploy_service_account_email" {
  description = "GitHub Actions Terraform deployer service account email."
  value       = module.jason.github_actions_deploy_service_account_email
}

output "github_actions_workload_identity_provider" {
  description = "Workload Identity provider resource name for GitHub Actions."
  value       = module.jason.github_actions_workload_identity_provider
}

output "budget_name" {
  description = "Monthly billing budget resource name, when billing_account_id is set."
  value       = module.jason.budget_name
}
