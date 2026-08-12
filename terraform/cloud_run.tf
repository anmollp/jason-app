resource "google_cloud_run_v2_service" "frontend" {
  project             = var.project_id
  location            = var.region
  name                = "${local.name_prefix}-frontend"
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  labels              = local.common_labels

  template {
    service_account = google_service_account.frontend.email

    scaling {
      min_instance_count = var.frontend_min_instances
      max_instance_count = var.frontend_max_instances
    }

    containers {
      image = local.frontend_image

      ports {
        container_port = 3000
      }

      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 12

        http_get {
          path = "/api/health"
          port = 3000
        }
      }

      liveness_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 5
        period_seconds        = 30
        failure_threshold     = 3

        http_get {
          path = "/api/health"
          port = 3000
        }
      }

      env {
        name  = "JASON_API_BASE_URL"
        value = google_cloud_run_v2_service.backend.uri
      }

      env {
        name  = "JASON_API_AUDIENCE"
        value = google_cloud_run_v2_service.backend.uri
      }

      env {
        name  = "AI_ENABLED"
        value = tostring(var.ai_enabled)
      }

      resources {
        limits = {
          cpu    = var.frontend_cpu
          memory = var.frontend_memory
        }

        startup_cpu_boost = var.frontend_startup_cpu_boost
      }
    }
  }

  depends_on = [
    google_project_service.required["run.googleapis.com"],
  ]

  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }
}

resource "google_cloud_run_v2_service" "backend" {
  project             = var.project_id
  location            = var.region
  name                = "${local.name_prefix}-backend"
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  labels              = local.common_labels

  template {
    service_account = google_service_account.backend.email

    scaling {
      min_instance_count = var.backend_min_instances
      max_instance_count = var.backend_max_instances
    }

    containers {
      image = local.backend_image

      ports {
        container_port = 3000
      }

      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 12

        http_get {
          path = "/health"
          port = 3000
        }
      }

      liveness_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 5
        period_seconds        = 30
        failure_threshold     = 3

        http_get {
          path = "/health"
          port = 3000
        }
      }

      env {
        name  = "JASON_CLI_PATH"
        value = var.jason_cli_path
      }

      env {
        name  = "AI_ENABLED"
        value = tostring(var.ai_enabled)
      }

      env {
        name  = "AI_PROVIDER"
        value = "openai"
      }

      env {
        name  = "AI_MODEL"
        value = "gpt-5.6-luna"
      }

      env {
        name  = "AI_COOKIE_SECURE"
        value = "true"
      }

      env {
        name  = "AI_DAILY_SESSION_LIMIT"
        value = tostring(var.ai_daily_session_limit)
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      dynamic "env" {
        for_each = var.openai_api_key_secret_version != "" && var.ai_identity_key_secret_version != "" ? {
          OPENAI_API_KEY = {
            secret  = google_secret_manager_secret.openai_api_key.secret_id
            version = var.openai_api_key_secret_version
          }
          AI_IDENTITY_KEY = {
            secret  = google_secret_manager_secret.ai_identity_key.secret_id
            version = var.ai_identity_key_secret_version
          }
        } : {}
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = var.backend_cpu
          memory = var.backend_memory
        }

        startup_cpu_boost = var.backend_startup_cpu_boost
      }
    }
  }

  depends_on = [
    google_project_iam_member.backend_firestore_user,
    google_secret_manager_secret_iam_member.backend_ai_identity_key,
    google_secret_manager_secret_iam_member.backend_openai_api_key,
    google_project_service.required["run.googleapis.com"],
  ]

  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  count = var.frontend_allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_domain_mapping" "frontend" {
  count = var.frontend_custom_domain == "" ? 0 : 1

  location = google_cloud_run_v2_service.frontend.location
  name     = var.frontend_custom_domain

  metadata {
    labels    = local.common_labels
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.frontend.name
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.frontend_public,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "frontend_invokes_backend" {
  project  = var.project_id
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.frontend.email}"
}
