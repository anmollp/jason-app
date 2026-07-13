variable "project_id" {
  description = "GCP project ID that will own the dev environment."
  type        = string
}

variable "region" {
  description = "GCP region for dev resources."
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Base service name used for resource naming."
  type        = string
  default     = "jason"
}

variable "frontend_image" {
  description = "Frontend container image URI to deploy to Cloud Run."
  type        = string
}

variable "backend_image" {
  description = "Backend container image URI to deploy to Cloud Run."
  type        = string
}

variable "frontend_min_instances" {
  description = "Minimum frontend Cloud Run instances. Keep 0 for cost control."
  type        = number
  default     = 0
}

variable "frontend_max_instances" {
  description = "Maximum frontend Cloud Run instances for dev."
  type        = number
  default     = 1
}

variable "backend_min_instances" {
  description = "Minimum backend Cloud Run instances. Keep 0 for cost control."
  type        = number
  default     = 0
}

variable "backend_max_instances" {
  description = "Maximum backend Cloud Run instances for dev."
  type        = number
  default     = 1
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
  description = "Monthly budget threshold in USD for alerting."
  type        = number
  default     = 10
}

variable "billing_account_id" {
  description = "GCP billing account ID. Required when budget resources are added."
  type        = string
  default     = ""
}
