mock_provider "google" {}

run "disabled_secure_defaults" {
  command = plan

  variables {
    project_id = "askjason-test"
  }

  assert {
    condition     = var.ai_enabled == false
    error_message = "The AI copilot must default to disabled."
  }

  assert {
    condition     = one([for env in google_cloud_run_v2_service.frontend.template[0].containers[0].env : env.value if env.name == "AI_ENABLED"]) == "false"
    error_message = "The frontend must hide the copilot while the shared AI flag is disabled."
  }

  assert {
    condition     = var.openai_api_key_secret_version == "" && var.ai_identity_key_secret_version == ""
    error_message = "Secret versions must remain detached by default."
  }

  assert {
    condition     = var.frontend_min_instances == 0 && var.backend_min_instances == 0
    error_message = "Cloud Run must retain scale-to-zero."
  }

  assert {
    condition     = var.frontend_max_instances == 1 && var.backend_max_instances == 1
    error_message = "Cloud Run must retain the approved one-instance cap."
  }

  assert {
    condition     = var.ai_daily_session_limit == 20
    error_message = "The release cap must default to 20 sessions per day."
  }

  assert {
    condition     = google_firestore_database.agent_state.location_id == "us-central1"
    error_message = "The quota database must remain in us-central1."
  }

  assert {
    condition     = google_firestore_database.agent_state.delete_protection_state == "DELETE_PROTECTION_ENABLED"
    error_message = "Firestore deletion protection must remain enabled."
  }

  assert {
    condition     = google_secret_manager_secret.openai_api_key.deletion_protection && google_secret_manager_secret.ai_identity_key.deletion_protection
    error_message = "AI secret containers must retain deletion protection."
  }
}
