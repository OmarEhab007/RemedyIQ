package ai

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRouter_Route(t *testing.T) {
	router := NewRouter()

	tests := []struct {
		name      string
		query     string
		wantSkill string
	}{
		{"performance - slow", "Why is my system slow?", "performance"},
		{"performance - latency", "What's the latency of API calls?", "performance"},
		{"performance - timeout", "I'm seeing timeout errors", "performance"},
		{"performance - bottleneck", "Where is the bottleneck?", "performance"},
		{"performance - optimize", "How can I optimize this?", "performance"},
		{"performance - longest escalation shorthand", "what is the longest running esc", "performance"},
		{"root_cause - root cause", "What is the root cause of this failure?", "root_cause"},
		{"root_cause - correlation", "Is there any correlation between these events?", "root_cause"},
		{"root_cause - why fail", "Why did the job fail?", "root_cause"},
		{"root_cause - cascading", "Show me cascading failures", "root_cause"},
		{"root_cause - spike", "What caused the spike in errors?", "root_cause"},
		{"error_explainer - error", "What is error ARERR 123?", "error_explainer"},
		{"error_explainer - ARERR", "Explain ARERR 552", "error_explainer"},
		{"error_explainer - exception", "What exception occurred?", "error_explainer"},
		{"error_explainer - failed", "The operation failed with error", "error_explainer"},
		{"error_explainer - stack trace", "Show me the stack trace", "error_explainer"},
		{"anomaly_narrator - anomaly", "Detect any anomalies in the logs?", "anomaly_narrator"},
		{"anomaly_narrator - unusual", "Is there unusual activity?", "anomaly_narrator"},
		{"anomaly_narrator - unexpected", "What unexpected events occurred?", "anomaly_narrator"},
		{"anomaly_narrator - deviation", "Show me deviations from normal", "anomaly_narrator"},
		{"anomaly_narrator - outlier", "Find outliers in the data", "anomaly_narrator"},
		{"summarizer - summarize", "Summarize this log analysis", "summarizer"},
		{"summarizer - overview", "Give me an overview of the analysis", "summarizer"},
		{"summarizer - executive", "Write an executive summary", "summarizer"},
		{"summarizer - brief", "Give me a brief of what happened", "summarizer"},
		{"summarizer - report", "Generate a report of findings", "summarizer"},
		{"nl_query - fallback", "What happened?", "nl_query"},
		{"nl_query - fallback 2", "Show me the logs", "nl_query"},
		{"nl_query - fallback 3", "How many API calls were made?", "nl_query"},
		{"case insensitive", "WHY IS MY SYSTEM SLOW?", "performance"},
		{"partial keyword", "The latency increased significantly", "performance"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := router.Route(tt.query)
			assert.Equal(t, tt.wantSkill, got, "Route(%q) = %q, want %q", tt.query, got, tt.wantSkill)
		})
	}
}

func TestRouter_AllSkills(t *testing.T) {
	router := NewRouter()
	skills := router.ListSkills()

	expectedSkills := []string{
		"performance",
		"root_cause",
		"error_explainer",
		"anomaly_narrator",
		"summarizer",
		"nl_query",
	}

	assert.ElementsMatch(t, expectedSkills, skills)
}

func TestRouter_GetRuleForSkill(t *testing.T) {
	router := NewRouter()

	rule := router.GetRuleForSkill("performance")
	assert.NotNil(t, rule)
	assert.Equal(t, "performance", rule.SkillName)
	assert.Contains(t, rule.Keywords, "slow")

	rule = router.GetRuleForSkill("nl_query")
	assert.Nil(t, rule)

	rule = router.GetRuleForSkill("nonexistent")
	assert.Nil(t, rule)
}

func TestRouter_Priority(t *testing.T) {
	router := NewRouter()

	query := "I have slow performance errors with anomalies"
	got := router.Route(query)
	assert.Equal(t, "performance", got, "First matching rule should take priority")
}
