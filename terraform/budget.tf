data "google_project" "current" {
  project_id = var.project_id
}

resource "google_billing_budget" "monthly_project_budget" {
  count = local.create_budget_alert ? 1 : 0

  billing_account = var.billing_account_id
  display_name    = "${local.name_prefix} monthly budget"

  budget_filter {
    calendar_period = "MONTH"
    projects        = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.8
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  depends_on = [
    google_project_service.required["billingbudgets.googleapis.com"],
  ]
}
