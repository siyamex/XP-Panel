package domain

import "time"

type Plan struct {
	ID                  string         `json:"id"`
	Name                string         `json:"name"`
	Slug                string         `json:"slug"`
	PriceMonthly        float64        `json:"price_monthly"`
	PriceYearly         float64        `json:"price_yearly"`
	Currency            string         `json:"currency"`
	Features            map[string]any `json:"features"`
	Limits              map[string]any `json:"limits"`
	IsActive            bool           `json:"is_active"`
}

type Subscription struct {
	ID                  string     `json:"id"`
	OrganizationID      string     `json:"organization_id"`
	PlanID              string     `json:"plan_id"`
	Plan                *Plan      `json:"plan,omitempty"`
	Status              string     `json:"status"`
	BillingCycle        string     `json:"billing_cycle"`
	StripeSubscriptionID string    `json:"stripe_subscription_id,omitempty"`
	CurrentPeriodStart  *time.Time `json:"current_period_start"`
	CurrentPeriodEnd    *time.Time `json:"current_period_end"`
	CancelAtPeriodEnd   bool       `json:"cancel_at_period_end"`
	TrialEndsAt         *time.Time `json:"trial_ends_at"`
	CreatedAt           time.Time  `json:"created_at"`
}

type Invoice struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	Number         string     `json:"number"`
	Status         string     `json:"status"`
	AmountDue      float64    `json:"amount_due"`
	AmountPaid     float64    `json:"amount_paid"`
	Currency       string     `json:"currency"`
	PeriodStart    *time.Time `json:"period_start"`
	PeriodEnd      *time.Time `json:"period_end"`
	DueDate        *time.Time `json:"due_date"`
	PaidAt         *time.Time `json:"paid_at"`
	PDFURL         string     `json:"pdf_url"`
	CreatedAt      time.Time  `json:"created_at"`
}

type UsageRecord struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Metric         string    `json:"metric"`
	Value          float64   `json:"value"`
	RecordedAt     time.Time `json:"recorded_at"`
}

type CreateSubscriptionRequest struct {
	PlanSlug     string `json:"plan_slug"`
	BillingCycle string `json:"billing_cycle"`
}

type CancelSubscriptionRequest struct {
	AtPeriodEnd bool `json:"at_period_end"`
}
