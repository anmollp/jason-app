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
