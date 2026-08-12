resource "google_logging_project_exclusion" "agent_content_fields" {
  project     = var.project_id
  name        = "${local.name_prefix}-agent-content-fields"
  description = "Fail-safe exclusion for accidental structured AI content logs. Approved audit fields do not match this filter."
  disabled    = false
  filter = join(" AND ", [
    "resource.type=\"cloud_run_revision\"",
    "resource.labels.service_name=\"${google_cloud_run_v2_service.backend.name}\"",
    "(jsonPayload.prompt:* OR jsonPayload.instruction:* OR jsonPayload.context:* OR jsonPayload.document:* OR jsonPayload.response:* OR jsonPayload.userAgent:* OR jsonPayload.ipAddress:*)",
  ])

  depends_on = [
    google_project_service.required["logging.googleapis.com"],
  ]
}
