resource "google_secret_manager_secret" "openai_api_key" {
  project             = var.project_id
  secret_id           = "${local.name_prefix}-openai-api-key"
  labels              = local.common_labels
  deletion_protection = true

  replication {
    auto {}
  }

  depends_on = [
    google_project_service.required["secretmanager.googleapis.com"],
  ]
}

resource "google_secret_manager_secret" "ai_identity_key" {
  project             = var.project_id
  secret_id           = "${local.name_prefix}-ai-identity-key"
  labels              = local.common_labels
  deletion_protection = true

  replication {
    auto {}
  }

  depends_on = [
    google_project_service.required["secretmanager.googleapis.com"],
  ]
}

resource "google_secret_manager_secret_iam_member" "backend_openai_api_key" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.openai_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "backend_ai_identity_key" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.ai_identity_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}
