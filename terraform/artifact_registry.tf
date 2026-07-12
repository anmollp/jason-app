resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = local.artifact_registry_repository_id
  description   = "Docker images for Jason ${var.environment} services."
  format        = "DOCKER"
  labels        = local.common_labels

  depends_on = [
    google_project_service.required["artifactregistry.googleapis.com"],
  ]
}
