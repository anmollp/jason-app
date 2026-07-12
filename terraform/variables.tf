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
  description = "Frontend container image URI. Used once Cloud Run resources are added."
  type        = string
  default     = ""
}

variable "backend_image" {
  description = "Backend container image URI. Used once Cloud Run resources are added."
  type        = string
  default     = ""
}

variable "frontend_min_instances" {
  description = "Minimum frontend Cloud Run instances. Keep 0 for cost control."
  type        = number
  default     = 0
}

variable "frontend_max_instances" {
  description = "Maximum frontend Cloud Run instances for the initial deployment."
  type        = number
  default     = 1
}

variable "backend_min_instances" {
  description = "Minimum backend Cloud Run instances. Keep 0 for cost control."
  type        = number
  default     = 0
}

variable "backend_max_instances" {
  description = "Maximum backend Cloud Run instances for the initial deployment."
  type        = number
  default     = 1
}

variable "budget_amount_usd" {
  description = "Monthly budget threshold in USD for alerting. Budget resource will be added later."
  type        = number
  default     = 10
}

variable "billing_account_id" {
  description = "GCP billing account ID. Required when budget resources are added."
  type        = string
  default     = ""
}
