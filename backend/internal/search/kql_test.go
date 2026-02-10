package search

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// ParseKQL - basic field:value
// ---------------------------------------------------------------------------

func TestParseKQL_SimpleFieldValue(t *testing.T) {
	tests := []struct {
		name  string
		input string
		field string
		op    FilterOp
		value string
	}{
		{"type equals", "type:API", "type", OpEquals, "API"},
		{"user equals", "user:Demo", "user", OpEquals, "Demo"},
		{"form equals", "form:TestForm", "form", OpEquals, "TestForm"},
		{"duration equals", "duration:1000", "duration", OpEquals, "1000"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			node, err := ParseKQL(tc.input)
			require.NoError(t, err)
			require.NotNil(t, node)
			assert.True(t, node.IsLeaf())
			assert.Equal(t, tc.field, node.Field)
			assert.Equal(t, tc.op, node.Op)
			assert.Equal(t, tc.value, node.Value)
		})
	}
}

// ---------------------------------------------------------------------------
// ParseKQL - AND, OR, NOT operators
// ---------------------------------------------------------------------------

func TestParseKQL_ExplicitAND(t *testing.T) {
	node, err := ParseKQL("type:API AND user:Demo")
	require.NoError(t, err)
	require.NotNil(t, node)

	assert.Equal(t, BoolAnd, node.BoolOp)
	require.Len(t, node.Children, 2)

	assert.Equal(t, "type", node.Children[0].Field)
	assert.Equal(t, "API", node.Children[0].Value)
	assert.Equal(t, "user", node.Children[1].Field)
	assert.Equal(t, "Demo", node.Children[1].Value)
}

func TestParseKQL_ImplicitAND(t *testing.T) {
	node, err := ParseKQL("type:API user:Demo")
	require.NoError(t, err)
	require.NotNil(t, node)

	assert.Equal(t, BoolAnd, node.BoolOp)
	require.Len(t, node.Children, 2)

	assert.Equal(t, "type", node.Children[0].Field)
	assert.Equal(t, "user", node.Children[1].Field)
}

func TestParseKQL_OR(t *testing.T) {
	node, err := ParseKQL("type:API OR type:SQL")
	require.NoError(t, err)
	require.NotNil(t, node)

	assert.Equal(t, BoolOr, node.BoolOp)
	require.Len(t, node.Children, 2)

	assert.Equal(t, "type", node.Children[0].Field)
	assert.Equal(t, "API", node.Children[0].Value)
	assert.Equal(t, "type", node.Children[1].Field)
	assert.Equal(t, "SQL", node.Children[1].Value)
}

func TestParseKQL_NOT(t *testing.T) {
	node, err := ParseKQL("NOT type:SQL")
	require.NoError(t, err)
	require.NotNil(t, node)

	assert.Equal(t, BoolNot, node.BoolOp)
	require.Len(t, node.Children, 1)

	child := node.Children[0]
	assert.Equal(t, "type", child.Field)
	assert.Equal(t, "SQL", child.Value)
}

func TestParseKQL_CaseInsensitiveOperators(t *testing.T) {
	tests := []struct {
		input  string
		boolOp BoolOp
	}{
		{"type:API and user:Demo", BoolAnd},
		{"type:API And user:Demo", BoolAnd},
		{"type:API or type:SQL", BoolOr},
		{"type:API Or type:SQL", BoolOr},
		{"not type:SQL", BoolNot},
		{"Not type:SQL", BoolNot},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			node, err := ParseKQL(tc.input)
			require.NoError(t, err)
			require.NotNil(t, node)
			assert.Equal(t, tc.boolOp, node.BoolOp)
		})
	}
}

// ---------------------------------------------------------------------------
// ParseKQL - operator precedence: NOT > AND > OR
// ---------------------------------------------------------------------------

func TestParseKQL_Precedence_ANDBeforeOR(t *testing.T) {
	// "a OR b AND c" should parse as "a OR (b AND c)"
	node, err := ParseKQL("type:API OR user:Demo AND queue:Admin")
	require.NoError(t, err)
	require.NotNil(t, node)

	// Top-level should be OR.
	assert.Equal(t, BoolOr, node.BoolOp)
	require.Len(t, node.Children, 2)

	// Left child: type:API (leaf)
	assert.True(t, node.Children[0].IsLeaf())
	assert.Equal(t, "type", node.Children[0].Field)

	// Right child: AND node
	assert.Equal(t, BoolAnd, node.Children[1].BoolOp)
}

func TestParseKQL_Precedence_NOTBeforeAND(t *testing.T) {
	// "NOT type:SQL AND user:Demo" should parse as "(NOT type:SQL) AND user:Demo"
	node, err := ParseKQL("NOT type:SQL AND user:Demo")
	require.NoError(t, err)
	require.NotNil(t, node)

	assert.Equal(t, BoolAnd, node.BoolOp)
	require.Len(t, node.Children, 2)

	// Left child: NOT node
	assert.Equal(t, BoolNot, node.Children[0].BoolOp)
	assert.Equal(t, "type", node.Children[0].Children[0].Field)

	// Right child: user:Demo
	assert.Equal(t, "user", node.Children[1].Field)
}

// ---------------------------------------------------------------------------
// ParseKQL - range operators
// ---------------------------------------------------------------------------

func TestParseKQL_RangeOperators(t *testing.T) {
	tests := []struct {
		name  string
		input string
		op    FilterOp
		value string
	}{
		{"greater than", "duration:>1000", OpGreaterThan, "1000"},
		{"greater equal", "duration:>=100", OpGreaterEqual, "100"},
		{"less than", "duration:<500", OpLessThan, "500"},
		{"less equal", "duration:<=5000", OpLessEqual, "5000"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			node, err := ParseKQL(tc.input)
			require.NoError(t, err)
			require.NotNil(t, node)
			assert.True(t, node.IsLeaf())
			assert.Equal(t, "duration", node.Field)
			assert.Equal(t, tc.op, node.Op)
			assert.Equal(t, tc.value, node.Value)
		})
	}
}

func TestParseKQL_RangeWithAND(t *testing.T) {
	node, err := ParseKQL("type:API AND duration:>1000")
	require.NoError(t, err)
	require.NotNil(t, node)

	assert.Equal(t, BoolAnd, node.BoolOp)
	require.Len(t, node.Children, 2)

	assert.Equal(t, OpEquals, node.Children[0].Op)
	assert.Equal(t, OpGreaterThan, node.Children[1].Op)
	assert.Equal(t, "1000", node.Children[1].Value)
}

// ---------------------------------------------------------------------------
// ParseKQL - wildcards
// ---------------------------------------------------------------------------

func TestParseKQL_Wildcard(t *testing.T) {
	tests := []struct {
		name  string
		input string
		field string
		value string
	}{
		{"trailing star", "form:HPD*", "form", "HPD*"},
		{"leading star", "user:*admin", "user", "*admin"},
		{"middle star", "form:HPD*Desk", "form", "HPD*Desk"},
		{"identifier", "identifier:GET*", "identifier", "GET*"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			node, err := ParseKQL(tc.input)
			require.NoError(t, err)
			require.NotNil(t, node)
			assert.True(t, node.IsLeaf())
			assert.Equal(t, OpWildcard, node.Op)
			assert.Equal(t, tc.field, node.Field)
			assert.Equal(t, tc.value, node.Value)
		})
	}
}

// ---------------------------------------------------------------------------
// ParseKQL - quoted strings
// ---------------------------------------------------------------------------

func TestParseKQL_QuotedStringsWithSpaces(t *testing.T) {
	node, err := ParseKQL(`user:"John Doe"`)
	require.NoError(t, err)
	require.NotNil(t, node)
	assert.True(t, node.IsLeaf())
	assert.Equal(t, "user", node.Field)
	assert.Equal(t, OpEquals, node.Op)
	assert.Equal(t, "John Doe", node.Value)
}

func TestParseKQL_QuotedStringsWithColons(t *testing.T) {
	node, err := ParseKQL(`form:"HPD:Help Desk"`)
	require.NoError(t, err)
	require.NotNil(t, node)
	assert.True(t, node.IsLeaf())
	assert.Equal(t, "form", node.Field)
	assert.Equal(t, OpEquals, node.Op)
	assert.Equal(t, "HPD:Help Desk", node.Value)
}

func TestParseKQL_QuotedStringFulltext(t *testing.T) {
	node, err := ParseKQL(`"error timeout"`)
	require.NoError(t, err)
	require.NotNil(t, node)
	assert.True(t, node.IsLeaf())
	assert.Equal(t, OpFullText, node.Op)
	assert.Equal(t, "error timeout", node.Value)
}

// ---------------------------------------------------------------------------
// ParseKQL - bare terms (fulltext search)
// ---------------------------------------------------------------------------

func TestParseKQL_BareTerm(t *testing.T) {
	node, err := ParseKQL("error")
	require.NoError(t, err)
	require.NotNil(t, node)
	assert.True(t, node.IsLeaf())
	assert.Equal(t, OpFullText, node.Op)
	assert.Equal(t, "error", node.Value)
}

func TestParseKQL_MultipleBareTerms(t *testing.T) {
	// Two bare words should be implicitly ANDed.
	node, err := ParseKQL("error timeout")
	require.NoError(t, err)
	require.NotNil(t, node)

	assert.Equal(t, BoolAnd, node.BoolOp)
	require.Len(t, node.Children, 2)

	assert.Equal(t, OpFullText, node.Children[0].Op)
	assert.Equal(t, "error", node.Children[0].Value)
	assert.Equal(t, OpFullText, node.Children[1].Op)
	assert.Equal(t, "timeout", node.Children[1].Value)
}

// ---------------------------------------------------------------------------
// ParseKQL - time ranges
// ---------------------------------------------------------------------------

func TestParseKQL_TimestampRange(t *testing.T) {
	node, err := ParseKQL("timestamp:>2026-02-03T10:00:00")
	require.NoError(t, err)
	require.NotNil(t, node)
	assert.True(t, node.IsLeaf())
	assert.Equal(t, "timestamp", node.Field)
	assert.Equal(t, OpGreaterThan, node.Op)
	assert.Equal(t, "2026-02-03T10:00:00", node.Value)
}

func TestParseKQL_TimestampRangeWithTimezone(t *testing.T) {
	node, err := ParseKQL("timestamp:>=2026-02-03T10:00:00+05:00")
	require.NoError(t, err)
	require.NotNil(t, node)
	assert.Equal(t, "timestamp", node.Field)
	assert.Equal(t, OpGreaterEqual, node.Op)
	assert.Equal(t, "2026-02-03T10:00:00+05:00", node.Value)
}

// ---------------------------------------------------------------------------
// ParseKQL - parenthesized groups
// ---------------------------------------------------------------------------

func TestParseKQL_Parentheses(t *testing.T) {
	node, err := ParseKQL("(type:API OR type:SQL) AND duration:>1000")
	require.NoError(t, err)
	require.NotNil(t, node)

	// Top level: AND
	assert.Equal(t, BoolAnd, node.BoolOp)
	require.Len(t, node.Children, 2)

	// Left: OR group
	orNode := node.Children[0]
	assert.Equal(t, BoolOr, orNode.BoolOp)
	require.Len(t, orNode.Children, 2)
	assert.Equal(t, "API", orNode.Children[0].Value)
	assert.Equal(t, "SQL", orNode.Children[1].Value)

	// Right: duration:>1000
	durNode := node.Children[1]
	assert.True(t, durNode.IsLeaf())
	assert.Equal(t, "duration", durNode.Field)
	assert.Equal(t, OpGreaterThan, durNode.Op)
	assert.Equal(t, "1000", durNode.Value)
}

func TestParseKQL_NestedParentheses(t *testing.T) {
	node, err := ParseKQL("((type:API OR type:SQL) AND user:Demo) OR queue:Admin")
	require.NoError(t, err)
	require.NotNil(t, node)

	// Top level: OR
	assert.Equal(t, BoolOr, node.BoolOp)
	require.Len(t, node.Children, 2)

	// Left: AND
	andNode := node.Children[0]
	assert.Equal(t, BoolAnd, andNode.BoolOp)
	require.Len(t, andNode.Children, 2)

	// Left-left: OR (API|SQL)
	assert.Equal(t, BoolOr, andNode.Children[0].BoolOp)
}

// ---------------------------------------------------------------------------
// ParseKQL - mixed queries
// ---------------------------------------------------------------------------

func TestParseKQL_MixedFieldAndFulltext(t *testing.T) {
	node, err := ParseKQL("type:API error")
	require.NoError(t, err)
	require.NotNil(t, node)

	assert.Equal(t, BoolAnd, node.BoolOp)
	require.Len(t, node.Children, 2)

	assert.Equal(t, "type", node.Children[0].Field)
	assert.Equal(t, OpEquals, node.Children[0].Op)
	assert.Equal(t, OpFullText, node.Children[1].Op)
	assert.Equal(t, "error", node.Children[1].Value)
}

func TestParseKQL_ComplexMixed(t *testing.T) {
	input := `type:API AND (form:"HPD:Help Desk" OR form:SHR*) AND duration:>500 AND NOT user:Admin`
	node, err := ParseKQL(input)
	require.NoError(t, err)
	require.NotNil(t, node)

	// The tree should be: AND(AND(AND(type:API, OR(form:..., form:SHR*)), duration:>500), NOT(user:Admin))
	// Because AND is left-associative.
	assert.False(t, node.IsLeaf())
}

// ---------------------------------------------------------------------------
// ParseKQL - empty query
// ---------------------------------------------------------------------------

func TestParseKQL_EmptyQuery(t *testing.T) {
	node, err := ParseKQL("")
	assert.NoError(t, err)
	assert.Nil(t, node)
}

func TestParseKQL_WhitespaceOnly(t *testing.T) {
	node, err := ParseKQL("   \t\n  ")
	assert.NoError(t, err)
	assert.Nil(t, node)
}

// ---------------------------------------------------------------------------
// ParseKQL - invalid queries
// ---------------------------------------------------------------------------

func TestParseKQL_UnterminatedQuote(t *testing.T) {
	_, err := ParseKQL(`user:"John Doe`)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unterminated")
}

func TestParseKQL_MissingCloseParen(t *testing.T) {
	_, err := ParseKQL("(type:API OR type:SQL")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parenthesis")
}

func TestParseKQL_MissingValueAfterColon(t *testing.T) {
	_, err := ParseKQL("type:")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "expected value")
}

func TestParseKQL_TrailingOperator(t *testing.T) {
	_, err := ParseKQL("type:API AND")
	assert.Error(t, err)
}

func TestParseKQL_LeadingOR(t *testing.T) {
	// "OR" at the start is just a bare word (potential field name or fulltext).
	// But if the next token is also a word, it gets parsed as implicit AND of
	// fulltext terms. This should not panic.
	node, err := ParseKQL("OR type:API")
	// "OR" is treated as a bare fulltext word here because there is nothing to
	// the left of it. The parser treats "OR" at position 0 as a word.
	// Actually, at the top level, parseOr calls parseAnd which calls parseNot
	// which calls parseAtom. parseAtom sees "OR" as a word token, checks if
	// the next token is ':', it isn't (next is "type"), so it returns fulltext("OR").
	// Then parseAnd sees "type" as a next word and does implicit AND.
	// Result: AND(fulltext("OR"), type:API)
	require.NoError(t, err)
	require.NotNil(t, node)
}

func TestParseKQL_UnexpectedRParen(t *testing.T) {
	_, err := ParseKQL("type:API)")
	assert.Error(t, err)
}

// ---------------------------------------------------------------------------
// IsLeaf
// ---------------------------------------------------------------------------

func TestQueryNode_IsLeaf(t *testing.T) {
	leaf := &QueryNode{Field: "type", Op: OpEquals, Value: "API"}
	assert.True(t, leaf.IsLeaf())

	ftLeaf := &QueryNode{Op: OpFullText, Value: "error"}
	assert.True(t, ftLeaf.IsLeaf())

	branch := &QueryNode{BoolOp: BoolAnd, Children: []*QueryNode{leaf, ftLeaf}}
	assert.False(t, branch.IsLeaf())
}

// ---------------------------------------------------------------------------
// ToClickHouseWhere - SQL generation
// ---------------------------------------------------------------------------

func TestToClickHouseWhere_Nil(t *testing.T) {
	var node *QueryNode
	sql, params := node.ToClickHouseWhere()
	assert.Equal(t, "1=1", sql)
	assert.Nil(t, params)
}

func TestToClickHouseWhere_SimpleEquals(t *testing.T) {
	node := &QueryNode{Field: "type", Op: OpEquals, Value: "API"}
	sql, params := node.ToClickHouseWhere()
	assert.Equal(t, "log_type = ?", sql)
	require.Len(t, params, 1)
	assert.Equal(t, "API", params[0])
}

func TestToClickHouseWhere_FieldMapping(t *testing.T) {
	tests := []struct {
		field    string
		expected string
	}{
		{"type", "log_type"},
		{"log_type", "log_type"},
		{"user", "user"},
		{"form", "form"},
		{"queue", "queue"},
		{"thread", "thread_id"},
		{"trace", "trace_id"},
		{"rpc", "rpc_id"},
		{"duration", "duration_ms"},
		{"status", "success"},
		{"api_code", "api_code"},
		{"sql_table", "sql_table"},
		{"filter", "filter_name"},
		{"escalation", "esc_name"},
		{"timestamp", "timestamp"},
		{"error", "error_message"},
		{"identifier", "api_code"},
	}

	for _, tc := range tests {
		t.Run(tc.field, func(t *testing.T) {
			node := &QueryNode{Field: tc.field, Op: OpEquals, Value: "test"}
			sql, _ := node.ToClickHouseWhere()
			assert.True(t, strings.HasPrefix(sql, tc.expected+" "),
				"expected column %s for field %s, got SQL: %s", tc.expected, tc.field, sql)
		})
	}
}

func TestToClickHouseWhere_UnknownField(t *testing.T) {
	node := &QueryNode{Field: "custom_field", Op: OpEquals, Value: "val"}
	sql, params := node.ToClickHouseWhere()
	assert.Equal(t, "custom_field = ?", sql)
	require.Len(t, params, 1)
	assert.Equal(t, "val", params[0])
}

func TestToClickHouseWhere_RangeOperators(t *testing.T) {
	tests := []struct {
		op       FilterOp
		expected string
	}{
		{OpGreaterThan, "duration_ms > ?"},
		{OpGreaterEqual, "duration_ms >= ?"},
		{OpLessThan, "duration_ms < ?"},
		{OpLessEqual, "duration_ms <= ?"},
		{OpNotEquals, "duration_ms != ?"},
	}

	for _, tc := range tests {
		t.Run(string(tc.op), func(t *testing.T) {
			node := &QueryNode{Field: "duration", Op: tc.op, Value: "1000"}
			sql, params := node.ToClickHouseWhere()
			assert.Equal(t, tc.expected, sql)
			require.Len(t, params, 1)
		})
	}
}

func TestToClickHouseWhere_Wildcard(t *testing.T) {
	node := &QueryNode{Field: "form", Op: OpWildcard, Value: "HPD*"}
	sql, params := node.ToClickHouseWhere()
	assert.Equal(t, "form ILIKE ?", sql)
	require.Len(t, params, 1)
	assert.Equal(t, "HPD%", params[0])
}

func TestToClickHouseWhere_FullText(t *testing.T) {
	node := &QueryNode{Op: OpFullText, Value: "error"}
	sql, params := node.ToClickHouseWhere()
	assert.Equal(t, "raw_text ILIKE ?", sql)
	require.Len(t, params, 1)
	assert.Equal(t, "%error%", params[0])
}

func TestToClickHouseWhere_AND(t *testing.T) {
	node := &QueryNode{
		BoolOp: BoolAnd,
		Children: []*QueryNode{
			{Field: "type", Op: OpEquals, Value: "API"},
			{Field: "user", Op: OpEquals, Value: "Demo"},
		},
	}
	sql, params := node.ToClickHouseWhere()
	assert.Equal(t, "(log_type = ? AND user = ?)", sql)
	require.Len(t, params, 2)
	assert.Equal(t, "API", params[0])
	assert.Equal(t, "Demo", params[1])
}

func TestToClickHouseWhere_OR(t *testing.T) {
	node := &QueryNode{
		BoolOp: BoolOr,
		Children: []*QueryNode{
			{Field: "type", Op: OpEquals, Value: "API"},
			{Field: "type", Op: OpEquals, Value: "SQL"},
		},
	}
	sql, params := node.ToClickHouseWhere()
	assert.Equal(t, "(log_type = ? OR log_type = ?)", sql)
	require.Len(t, params, 2)
	assert.Equal(t, "API", params[0])
	assert.Equal(t, "SQL", params[1])
}

func TestToClickHouseWhere_NOT(t *testing.T) {
	node := &QueryNode{
		BoolOp: BoolNot,
		Children: []*QueryNode{
			{Field: "type", Op: OpEquals, Value: "SQL"},
		},
	}
	sql, params := node.ToClickHouseWhere()
	assert.Equal(t, "NOT (log_type = ?)", sql)
	require.Len(t, params, 1)
	assert.Equal(t, "SQL", params[0])
}

func TestToClickHouseWhere_ComplexTree(t *testing.T) {
	// (type:API OR type:SQL) AND duration:>1000
	node := &QueryNode{
		BoolOp: BoolAnd,
		Children: []*QueryNode{
			{
				BoolOp: BoolOr,
				Children: []*QueryNode{
					{Field: "type", Op: OpEquals, Value: "API"},
					{Field: "type", Op: OpEquals, Value: "SQL"},
				},
			},
			{Field: "duration", Op: OpGreaterThan, Value: "1000"},
		},
	}
	sql, params := node.ToClickHouseWhere()
	assert.Equal(t, "((log_type = ? OR log_type = ?) AND duration_ms > ?)", sql)
	require.Len(t, params, 3)
	assert.Equal(t, "API", params[0])
	assert.Equal(t, "SQL", params[1])
	assert.Equal(t, "1000", params[2])
}

// ---------------------------------------------------------------------------
// Integration: ParseKQL + ToClickHouseWhere end-to-end
// ---------------------------------------------------------------------------

func TestEndToEnd_ParseAndGenerate(t *testing.T) {
	tests := []struct {
		name        string
		kql         string
		expectedSQL string
		paramCount  int
	}{
		{
			name:        "simple equals",
			kql:         "type:API",
			expectedSQL: "log_type = ?",
			paramCount:  1,
		},
		{
			name:        "and",
			kql:         "type:API AND user:Demo",
			expectedSQL: "(log_type = ? AND user = ?)",
			paramCount:  2,
		},
		{
			name:        "or",
			kql:         "type:API OR type:SQL",
			expectedSQL: "(log_type = ? OR log_type = ?)",
			paramCount:  2,
		},
		{
			name:        "not",
			kql:         "NOT type:SQL",
			expectedSQL: "NOT (log_type = ?)",
			paramCount:  1,
		},
		{
			name:        "range gt",
			kql:         "duration:>1000",
			expectedSQL: "duration_ms > ?",
			paramCount:  1,
		},
		{
			name:        "wildcard",
			kql:         "form:HPD*",
			expectedSQL: "form ILIKE ?",
			paramCount:  1,
		},
		{
			name:        "fulltext",
			kql:         "error",
			expectedSQL: "raw_text ILIKE ?",
			paramCount:  1,
		},
		{
			name:        "parenthesized or with and",
			kql:         "(type:API OR type:SQL) AND duration:>1000",
			expectedSQL: "((log_type = ? OR log_type = ?) AND duration_ms > ?)",
			paramCount:  3,
		},
		{
			name:        "quoted value",
			kql:         `form:"HPD:Help Desk"`,
			expectedSQL: "form = ?",
			paramCount:  1,
		},
		{
			name:        "not with and",
			kql:         "NOT type:SQL AND user:Demo",
			expectedSQL: "(NOT (log_type = ?) AND user = ?)",
			paramCount:  2,
		},
		{
			name:        "timestamp range",
			kql:         "timestamp:>2026-02-03T10:00:00",
			expectedSQL: "timestamp > ?",
			paramCount:  1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			node, err := ParseKQL(tc.kql)
			require.NoError(t, err)
			require.NotNil(t, node)

			sql, params := node.ToClickHouseWhere()
			assert.Equal(t, tc.expectedSQL, sql)
			assert.Len(t, params, tc.paramCount)
		})
	}
}

// ---------------------------------------------------------------------------
// Tokenizer edge cases
// ---------------------------------------------------------------------------

func TestTokenize_EmptyString(t *testing.T) {
	tokens, err := tokenize("")
	require.NoError(t, err)
	// Should contain just EOF.
	require.Len(t, tokens, 1)
	assert.Equal(t, tokEOF, tokens[0].kind)
}

func TestTokenize_QuotedStringWithSpecialChars(t *testing.T) {
	tokens, err := tokenize(`"HPD:Help Desk (v2)"`)
	require.NoError(t, err)
	// word + EOF
	require.Len(t, tokens, 2)
	assert.Equal(t, "HPD:Help Desk (v2)", tokens[0].val)
}

func TestTokenize_ComparisonOperators(t *testing.T) {
	tokens, err := tokenize(">= <= > <")
	require.NoError(t, err)
	require.Len(t, tokens, 5) // GTE, LTE, GT, LT, EOF
	assert.Equal(t, tokGTE, tokens[0].kind)
	assert.Equal(t, tokLTE, tokens[1].kind)
	assert.Equal(t, tokGT, tokens[2].kind)
	assert.Equal(t, tokLT, tokens[3].kind)
}

// ---------------------------------------------------------------------------
// KnownFields completeness
// ---------------------------------------------------------------------------

func TestKnownFields_ContainsExpectedEntries(t *testing.T) {
	expectedFields := []string{
		"type", "log_type", "user", "form", "queue", "thread",
		"trace", "rpc", "duration", "status", "api_code",
		"sql_table", "filter", "escalation", "timestamp", "error",
	}

	for _, field := range expectedFields {
		_, ok := KnownFields[field]
		assert.True(t, ok, "KnownFields should contain %q", field)
	}
}

// ---------------------------------------------------------------------------
// Three or more terms with implicit AND
// ---------------------------------------------------------------------------

func TestParseKQL_ThreeImplicitAND(t *testing.T) {
	node, err := ParseKQL("type:API user:Demo queue:Admin")
	require.NoError(t, err)
	require.NotNil(t, node)

	// Should produce AND(AND(type:API, user:Demo), queue:Admin) due to
	// left-to-right associativity.
	assert.Equal(t, BoolAnd, node.BoolOp)
	require.Len(t, node.Children, 2)

	// Right child is the last term.
	assert.True(t, node.Children[1].IsLeaf())
	assert.Equal(t, "queue", node.Children[1].Field)

	// Left child is another AND.
	assert.Equal(t, BoolAnd, node.Children[0].BoolOp)
}

// ---------------------------------------------------------------------------
// Wildcard patterns in SQL generation
// ---------------------------------------------------------------------------

func TestToClickHouseWhere_WildcardPatterns(t *testing.T) {
	tests := []struct {
		value    string
		expected string
	}{
		{"HPD*", "HPD%"},
		{"*admin", "%admin"},
		{"HPD*Desk", "HPD%Desk"},
		{"*", "%"},
		{"test*value*end", "test%value%end"},
	}

	for _, tc := range tests {
		t.Run(tc.value, func(t *testing.T) {
			node := &QueryNode{Field: "form", Op: OpWildcard, Value: tc.value}
			_, params := node.ToClickHouseWhere()
			require.Len(t, params, 1)
			assert.Equal(t, tc.expected, params[0])
		})
	}
}

// ---------------------------------------------------------------------------
// Double NOT
// ---------------------------------------------------------------------------

func TestParseKQL_DoubleNOT(t *testing.T) {
	node, err := ParseKQL("NOT NOT type:API")
	require.NoError(t, err)
	require.NotNil(t, node)

	assert.Equal(t, BoolNot, node.BoolOp)
	require.Len(t, node.Children, 1)

	inner := node.Children[0]
	assert.Equal(t, BoolNot, inner.BoolOp)
	require.Len(t, inner.Children, 1)

	leaf := inner.Children[0]
	assert.True(t, leaf.IsLeaf())
	assert.Equal(t, "type", leaf.Field)
	assert.Equal(t, "API", leaf.Value)
}
