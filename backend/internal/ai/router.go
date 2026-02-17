package ai

import (
	"regexp"
	"strings"
)

type RoutingRule struct {
	SkillName string
	Keywords  []string
	Patterns  []*regexp.Regexp
}

type Router struct {
	rules    []RoutingRule
	fallback string
}

func NewRouter() *Router {
	return &Router{
		rules: []RoutingRule{
			{
				SkillName: "performance",
				Keywords:  []string{"slow", "latency", "duration", "timeout", "bottleneck", "optimize", "tuning", "longest", "slowest"},
				Patterns: []*regexp.Regexp{
					regexp.MustCompile(`(?i)\besc(alation)?s?\b`),
				},
			},
			{
				SkillName: "root_cause",
				Keywords:  []string{"root cause", "correlat", "why", "cascading", "spike"},
				Patterns:  []*regexp.Regexp{regexp.MustCompile(`(?i)why.*fail`)},
			},
			{
				SkillName: "error_explainer",
				Keywords:  []string{"error", "arerr", "err", "exception", "failed", "stack trace"},
			},
			{
				SkillName: "anomaly_narrator",
				Keywords:  []string{"anomal", "unusual", "unexpected", "deviation", "outlier"},
			},
			{
				SkillName: "summarizer",
				Keywords:  []string{"summar", "overview", "executive", "brief", "report"},
			},
		},
		fallback: "nl_query",
	}
}

func (r *Router) Route(query string) string {
	queryLower := strings.ToLower(query)

	for _, rule := range r.rules {
		for _, pattern := range rule.Patterns {
			if pattern.MatchString(queryLower) {
				return rule.SkillName
			}
		}

		for _, keyword := range rule.Keywords {
			if strings.Contains(queryLower, keyword) {
				return rule.SkillName
			}
		}
	}

	return r.fallback
}

func (r *Router) GetRuleForSkill(skillName string) *RoutingRule {
	for i := range r.rules {
		if r.rules[i].SkillName == skillName {
			return &r.rules[i]
		}
	}
	return nil
}

func (r *Router) ListSkills() []string {
	skills := make([]string, 0, len(r.rules)+1)
	for _, rule := range r.rules {
		skills = append(skills, rule.SkillName)
	}
	skills = append(skills, r.fallback)
	return skills
}
