resource "google_firestore_database" "agent_state" {
  project                           = var.project_id
  name                              = "(default)"
  location_id                       = var.firestore_location
  type                              = "FIRESTORE_NATIVE"
  concurrency_mode                  = "PESSIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_DISABLED"
  deletion_policy                   = "ABANDON"
  delete_protection_state           = "DELETE_PROTECTION_ENABLED"

  depends_on = [
    google_project_service.required["firestore.googleapis.com"],
  ]
}

resource "google_project_iam_member" "backend_firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.backend.email}"

  depends_on = [google_firestore_database.agent_state]
}
