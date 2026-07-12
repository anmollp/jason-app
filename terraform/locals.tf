locals {
  name_prefix = "${var.service_name}-${var.environment}"

  common_labels = {
    app         = var.service_name
    environment = var.environment
    managed_by  = "terraform"
  }

  planned_services = {
    frontend = {
      name          = "${local.name_prefix}-frontend"
      image         = var.frontend_image
      min_instances = var.frontend_min_instances
      max_instances = var.frontend_max_instances
    }
    backend = {
      name          = "${local.name_prefix}-backend"
      image         = var.backend_image
      min_instances = var.backend_min_instances
      max_instances = var.backend_max_instances
    }
  }
}
