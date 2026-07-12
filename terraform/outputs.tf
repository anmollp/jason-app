output "name_prefix" {
  description = "Shared resource name prefix."
  value       = local.name_prefix
}

output "common_labels" {
  description = "Labels that should be applied to all supported resources."
  value       = local.common_labels
}

output "planned_services" {
  description = "Cloud Run service plan used by the next resource PR."
  value       = local.planned_services
}
