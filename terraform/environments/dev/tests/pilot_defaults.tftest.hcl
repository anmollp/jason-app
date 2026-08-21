mock_provider "google" {}

override_module {
  target = module.jason
}

run "pilot_quota_default" {
  command = plan

  variables {
    project_id = "askjason-test"
  }

  assert {
    condition     = var.ai_daily_session_limit == 10
    error_message = "The dev wrapper must default to the approved 10-session pilot quota."
  }
}
