variable "project_id" {
  description = "GCP project ID that will own Jason infrastructure."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run and Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "service_name" {
  description = "Base service name used for resource naming."
  type        = string
  default     = "jason"
}

variable "frontend_image" {
  description = "Optional frontend container image URI used when Terraform creates the Cloud Run service. Defaults to the local Artifact Registry frontend:latest image."
  type        = string
  default     = ""
}

variable "backend_image" {
  description = "Optional backend container image URI used when Terraform creates the Cloud Run service. Defaults to the local Artifact Registry backend:latest image."
  type        = string
  default     = ""
}

variable "frontend_min_instances" {
  description = "Minimum frontend Cloud Run instances. Keep 0 for cost control."
  type        = number
  default     = 0

  validation {
    condition     = var.frontend_min_instances == 0
    error_message = "frontend_min_instances must remain 0 for the approved cost envelope."
  }
}

variable "frontend_max_instances" {
  description = "Maximum frontend Cloud Run instances for the initial deployment."
  type        = number
  default     = 1

  validation {
    condition     = var.frontend_max_instances == 1
    error_message = "frontend_max_instances must remain 1 for the approved cost envelope."
  }
}

variable "backend_min_instances" {
  description = "Minimum backend Cloud Run instances. Keep 0 for cost control."
  type        = number
  default     = 0

  validation {
    condition     = var.backend_min_instances == 0
    error_message = "backend_min_instances must remain 0 for the approved cost envelope."
  }
}

variable "backend_max_instances" {
  description = "Maximum backend Cloud Run instances for the initial deployment."
  type        = number
  default     = 1

  validation {
    condition     = var.backend_max_instances == 1
    error_message = "backend_max_instances must remain 1 for the approved cost envelope."
  }
}

variable "frontend_cpu" {
  description = "Frontend Cloud Run CPU limit."
  type        = string
  default     = "1"
}

variable "frontend_memory" {
  description = "Frontend Cloud Run memory limit."
  type        = string
  default     = "512Mi"
}

variable "frontend_startup_cpu_boost" {
  description = "Enable Cloud Run startup CPU boost for faster frontend cold starts without keeping idle instances warm."
  type        = bool
  default     = true
}

variable "backend_cpu" {
  description = "Backend Cloud Run CPU limit."
  type        = string
  default     = "1"
}

variable "backend_memory" {
  description = "Backend Cloud Run memory limit."
  type        = string
  default     = "512Mi"
}

variable "backend_startup_cpu_boost" {
  description = "Enable Cloud Run startup CPU boost for faster backend cold starts without keeping idle instances warm."
  type        = bool
  default     = true
}

variable "jason_cli_path" {
  description = "Path to the Jason CLI binary inside the backend container."
  type        = string
  default     = "/usr/local/bin/jason"
}

variable "frontend_allow_unauthenticated" {
  description = "Whether the frontend Cloud Run service should be publicly invokable."
  type        = bool
  default     = true
}

variable "frontend_custom_domain" {
  description = "Optional custom domain for the public frontend Cloud Run service, for example app.example.com. Leave empty to skip domain mapping."
  type        = string
  default     = ""

  validation {
    condition = (
      var.frontend_custom_domain == "" ||
      (
        length(var.frontend_custom_domain) <= 64 &&
        can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.frontend_custom_domain))
      )
    )
    error_message = "frontend_custom_domain must be empty or a lowercase domain name without protocol or path, such as app.example.com."
  }
}

variable "github_repository" {
  description = "GitHub repository allowed to publish images through Workload Identity Federation."
  type        = string
  default     = "anmollp/jason-app"
}

variable "github_ref" {
  description = "Git ref allowed to publish images through Workload Identity Federation."
  type        = string
  default     = "refs/heads/master"
}

variable "budget_amount_usd" {
  description = "Monthly budget amount in USD for alerting."
  type        = number
  default     = 10

  validation {
    condition     = var.budget_amount_usd > 0 && var.budget_amount_usd <= 10
    error_message = "budget_amount_usd must remain at or below the approved $10 GCP alert."
  }
}

variable "firestore_location" {
  description = "Firestore database location for anonymous quota ledgers."
  type        = string
  default     = "us-central1"

  validation {
    condition     = var.firestore_location == "us-central1"
    error_message = "firestore_location must remain us-central1 for this approved release."
  }
}

variable "ai_enabled" {
  description = "Enable the hosted AI copilot. It remains false until a separately approved rollout."
  type        = bool
  default     = false

  validation {
    condition     = !var.ai_enabled || (var.openai_api_key_secret_version != "" && var.ai_identity_key_secret_version != "")
    error_message = "Both pinned AI secret version IDs are required before ai_enabled can be enabled."
  }
}

variable "openai_api_key_secret_version" {
  description = "Approved numeric OpenAI Secret Manager version to attach. Empty keeps the secret detached."
  type        = string
  default     = ""

  validation {
    condition     = var.openai_api_key_secret_version == "" || can(regex("^[1-9][0-9]*$", var.openai_api_key_secret_version))
    error_message = "openai_api_key_secret_version must be empty or a numeric version ID; latest is not allowed."
  }
}

variable "ai_identity_key_secret_version" {
  description = "Approved numeric identity-key Secret Manager version to attach. Empty keeps the secret detached."
  type        = string
  default     = ""

  validation {
    condition     = var.ai_identity_key_secret_version == "" || can(regex("^[1-9][0-9]*$", var.ai_identity_key_secret_version))
    error_message = "ai_identity_key_secret_version must be empty or a numeric version ID; latest is not allowed."
  }
}

variable "ai_daily_session_limit" {
  description = "Hosted AI sessions per UTC day: 10 for the pilot or 20 after separate expansion approval."
  type        = number
  default     = 20

  validation {
    condition     = contains([10, 20], var.ai_daily_session_limit)
    error_message = "ai_daily_session_limit must be the approved 10-session pilot or 20-session release cap."
  }
}

variable "billing_account_id" {
  description = "GCP billing account ID. Leave empty to skip creating budget alerts."
  type        = string
  default     = ""
}
