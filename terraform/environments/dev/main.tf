module "jason" {
  source = "../.."

  project_id  = var.project_id
  region      = var.region
  environment = "dev"

  service_name = var.service_name

  frontend_image = var.frontend_image
  backend_image  = var.backend_image

  frontend_min_instances         = var.frontend_min_instances
  frontend_max_instances         = var.frontend_max_instances
  backend_min_instances          = var.backend_min_instances
  backend_max_instances          = var.backend_max_instances
  frontend_cpu                   = var.frontend_cpu
  frontend_memory                = var.frontend_memory
  backend_cpu                    = var.backend_cpu
  backend_memory                 = var.backend_memory
  jason_cli_path                 = var.jason_cli_path
  frontend_allow_unauthenticated = var.frontend_allow_unauthenticated

  budget_amount_usd  = var.budget_amount_usd
  billing_account_id = var.billing_account_id
}
