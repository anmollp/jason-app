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
      image = var.frontend_image

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
      image = var.backend_image

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
    google_project_service.required["run.googleapis.com"],
  ]
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
