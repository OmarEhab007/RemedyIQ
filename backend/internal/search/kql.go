package search

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"

	"github.com/blevesearch/bleve/v2"
	bleveQuery "github.com/blevesearch/bleve/v2/search/query"
)

// FilterOp represents a comparison operator.
type FilterOp string

const (
	OpEquals       FilterOp = "eq"
	OpNotEquals    FilterOp = "neq"
	OpGreaterThan  FilterOp = "gt"
	OpGreaterEqual FilterOp = "gte"
	OpLessThan     FilterOp = "lt"
	OpLessEqual    FilterOp = "lte"
	OpWildcard     FilterOp = "wildcard"
	OpFullText     FilterOp = "fulltext"
)

// BoolOp represents a logical operator.
type BoolOp string

const (
	BoolAnd BoolOp = "AND"
	BoolOr  BoolOp = "OR"
	BoolNot BoolOp = "NOT"
)

// QueryNode represents a node in the parsed query tree.
type QueryNode struct {
	// For leaf nodes (field filters).
	Field string   `json:"field,omitempty"`
	Op    FilterOp `json:"op,omitempty"`
	Value string   `json:"value,omitempty"`

	// For branch nodes (boolean combinations).
	BoolOp   BoolOp       `json:"bool_op,omitempty"`
	Children []*QueryNode `json:"children,omitempty"`
}

// IsLeaf returns true if this is a field filter node (not a boolean combinator).
func (q *QueryNode) IsLeaf() bool {
	return q.BoolOp == ""
}

// KnownFields maps KQL field names to ClickHouse column names.
var KnownFields = map[string]string{
	"type":       "log_type",
	"log_type":   "log_type",
	"user":       "user",
	"form":       "form",
	"queue":      "queue",
	"thread":     "thread_id",
	"trace":      "trace_id",
	"rpc":        "rpc_id",
	"duration":   "duration_ms",
	"status":     "success",
	"api_code":   "api_code",
	"sql_table":  "sql_table",
	"filter":     "filter_name",
	"escalation": "esc_name",
	"timestamp":  "timestamp",
	"error":      "error_message",
	"identifier": "api_code",
}

// numericFields is the set of ClickHouse columns that hold numeric data. Range
// comparisons on these columns emit numeric parameter placeholders instead of
// string ones.
var numericFields = map[string]bool{
	"duration_ms": true,
}

// --------------------------------------------------------------------------
// Tokenizer
// --------------------------------------------------------------------------

// tokenKind distinguishes the different kinds of tokens emitted by the lexer.
type tokenKind int

const (
	tokWord   tokenKind = iota // bare word or quoted string
	tokColon                   // ':'
	tokLParen                  // '('
	tokRParen                  // ')'
	tokGT                      // '>'
	tokGTE                     // '>='
	tokLT                      // '<'
	tokLTE                     // '<='
	tokEOF                     // end of input
)

type token struct {
	kind tokenKind
	val  string
}

func (t token) String() string { return t.val }

// tokenize splits the raw KQL query string into a sequence of tokens.  Quoted
// strings are returned as a single tokWord with the quotes stripped.
func tokenize(input string) ([]token, error) {
	var tokens []token
	runes := []rune(input)
	i := 0

	for i < len(runes) {
		ch := runes[i]

		// Skip whitespace.
		if unicode.IsSpace(ch) {
			i++
			continue
		}

		// Quoted string.
		if ch == '"' {
			j := i + 1
			for j < len(runes) && runes[j] != '"' {
				j++
			}
			if j >= len(runes) {
				return nil, fmt.Errorf("unterminated quoted string starting at position %d", i)
			}
			tokens = append(tokens, token{kind: tokWord, val: string(runes[i+1 : j])})
			i = j + 1
			continue
		}

		// Single-character structural tokens.
		switch ch {
		case ':':
			tokens = append(tokens, token{kind: tokColon, val: ":"})
			i++
			continue
		case '(':
			tokens = append(tokens, token{kind: tokLParen, val: "("})
			i++
			continue
		case ')':
			tokens = append(tokens, token{kind: tokRParen, val: ")"})
			i++
			continue
		}

		// Comparison operators: >=, >, <=, <
		if ch == '>' {
			if i+1 < len(runes) && runes[i+1] == '=' {
				tokens = append(tokens, token{kind: tokGTE, val: ">="})
				i += 2
			} else {
				tokens = append(tokens, token{kind: tokGT, val: ">"})
				i++
			}
			continue
		}
		if ch == '<' {
			if i+1 < len(runes) && runes[i+1] == '=' {
				tokens = append(tokens, token{kind: tokLTE, val: "<="})
				i += 2
			} else {
				tokens = append(tokens, token{kind: tokLT, val: "<"})
				i++
			}
			continue
		}

		// Bare word: letters, digits, -, _, ., *, /, +, T (timestamps etc.)
		if isWordChar(ch) {
			j := i
			for j < len(runes) && isWordChar(runes[j]) {
				j++
			}
			tokens = append(tokens, token{kind: tokWord, val: string(runes[i:j])})
			i = j
			continue
		}

		return nil, fmt.Errorf("unexpected character %q at position %d", string(ch), i)
	}

	tokens = append(tokens, token{kind: tokEOF, val: ""})
	return tokens, nil
}

// isWordChar returns true for characters that may appear in unquoted values,
// field names, timestamps, wildcards, or numbers.
func isWordChar(ch rune) bool {
	return unicode.IsLetter(ch) || unicode.IsDigit(ch) ||
		ch == '_' || ch == '-' || ch == '.' || ch == '*' || ch == '/' || ch == '+'
}

// --------------------------------------------------------------------------
// Parser
// --------------------------------------------------------------------------

// parser holds the state for a recursive-descent parse of the token stream.
type parser struct {
	tokens []token
	pos    int
}

func (p *parser) peek() token {
	if p.pos >= len(p.tokens) {
		return token{kind: tokEOF}
	}
	return p.tokens[p.pos]
}

func (p *parser) advance() token {
	t := p.peek()
	if p.pos < len(p.tokens) {
		p.pos++
	}
	return t
}

func (p *parser) expect(kind tokenKind) (token, error) {
	t := p.advance()
	if t.kind != kind {
		return t, fmt.Errorf("expected token kind %d but got %q", kind, t.val)
	}
	return t, nil
}

// ParseKQL parses a KQL query string into a QueryNode tree.  An empty query
// returns nil with no error.  Syntactically invalid queries produce a
// descriptive error.
func ParseKQL(query string) (*QueryNode, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, nil
	}

	tokens, err := tokenize(query)
	if err != nil {
		return nil, fmt.Errorf("tokenize: %w", err)
	}

	p := &parser{tokens: tokens}
	node, err := p.parseOr()
	if err != nil {
		return nil, err
	}

	// Make sure we consumed everything.
	if t := p.peek(); t.kind != tokEOF {
		return nil, fmt.Errorf("unexpected token %q at position %d", t.val, p.pos)
	}

	return node, nil
}

// parseOr handles: expr (OR expr)*
func (p *parser) parseOr() (*QueryNode, error) {
	left, err := p.parseAnd()
	if err != nil {
		return nil, err
	}

	for p.peek().kind == tokWord && strings.EqualFold(p.peek().val, "OR") {
		p.advance() // consume OR
		right, err := p.parseAnd()
		if err != nil {
			return nil, err
		}
		left = &QueryNode{
			BoolOp:   BoolOr,
			Children: []*QueryNode{left, right},
		}
	}

	return left, nil
}

// parseAnd handles: expr (AND expr)* as well as implicit AND (adjacency).
func (p *parser) parseAnd() (*QueryNode, error) {
	left, err := p.parseNot()
	if err != nil {
		return nil, err
	}

	for {
		t := p.peek()

		// Explicit AND keyword.
		if t.kind == tokWord && strings.EqualFold(t.val, "AND") {
			p.advance()
			right, err := p.parseNot()
			if err != nil {
				return nil, err
			}
			left = &QueryNode{
				BoolOp:   BoolAnd,
				Children: []*QueryNode{left, right},
			}
			continue
		}

		// Implicit AND: the next token can start a new term (word or left
		// paren), but must not be OR, a right paren, or EOF.
		if (t.kind == tokWord && !strings.EqualFold(t.val, "OR")) || t.kind == tokLParen {
			right, err := p.parseNot()
			if err != nil {
				return nil, err
			}
			left = &QueryNode{
				BoolOp:   BoolAnd,
				Children: []*QueryNode{left, right},
			}
			continue
		}

		break
	}

	return left, nil
}

// parseNot handles: NOT expr | atom
func (p *parser) parseNot() (*QueryNode, error) {
	if p.peek().kind == tokWord && strings.EqualFold(p.peek().val, "NOT") {
		p.advance() // consume NOT
		child, err := p.parseNot()
		if err != nil {
			return nil, err
		}
		return &QueryNode{
			BoolOp:   BoolNot,
			Children: []*QueryNode{child},
		}, nil
	}
	return p.parseAtom()
}

// parseAtom handles:
//   - parenthesized groups:  ( expr )
//   - field:value            field:value, field:>value, field:"quoted"
//   - bare words             fulltext search
func (p *parser) parseAtom() (*QueryNode, error) {
	t := p.peek()

	// Parenthesized group.
	if t.kind == tokLParen {
		p.advance() // consume (
		node, err := p.parseOr()
		if err != nil {
			return nil, err
		}
		if _, err := p.expect(tokRParen); err != nil {
			return nil, fmt.Errorf("missing closing parenthesis")
		}
		return node, nil
	}

	if t.kind == tokWord {
		// Look ahead: is it field:value or a bare term?
		if p.pos+1 < len(p.tokens) && p.tokens[p.pos+1].kind == tokColon {
			return p.parseFieldValue()
		}

		// Bare word -- fulltext search.
		p.advance()
		return &QueryNode{
			Op:    OpFullText,
			Value: t.val,
		}, nil
	}

	return nil, fmt.Errorf("unexpected token %q at position %d", t.val, p.pos)
}

// parseFieldValue parses field:value, field:>value, field:>=value, etc.
// Values may contain colons (e.g. timestamps like 10:00:00 or timezone offsets
// like +05:00) so the parser greedily consumes colon+word sequences that look
// like value continuations rather than new field:value pairs.
func (p *parser) parseFieldValue() (*QueryNode, error) {
	fieldTok := p.advance() // field name
	p.advance()             // consume ':'

	// Determine operator.
	var op FilterOp
	switch p.peek().kind {
	case tokGT:
		op = OpGreaterThan
		p.advance()
	case tokGTE:
		op = OpGreaterEqual
		p.advance()
	case tokLT:
		op = OpLessThan
		p.advance()
	case tokLTE:
		op = OpLessEqual
		p.advance()
	default:
		op = OpEquals
	}

	// Value: first word segment is required.
	valTok := p.peek()
	if valTok.kind != tokWord {
		return nil, fmt.Errorf("expected value after %s: but got %q", fieldTok.val, valTok.val)
	}
	p.advance()

	// Greedily consume colon+word sequences that are value continuations.
	// A colon followed by a word is a value continuation (e.g. timestamp
	// 10:00:00 or timezone +05:00) when the word after the colon does NOT
	// itself have a colon following it that would indicate a nested
	// field:value pattern.  We use a simple heuristic: if the segment after
	// the colon looks numeric (digits only) or like a timezone offset, it is
	// part of the current value.
	val := valTok.val
	for p.peek().kind == tokColon {
		// Look two tokens ahead: colon + word.
		if p.pos+1 >= len(p.tokens) || p.tokens[p.pos+1].kind != tokWord {
			break
		}
		nextWord := p.tokens[p.pos+1].val
		// Check if this looks like a value continuation rather than a new
		// field:value pair. Value continuations are segments that are purely
		// numeric (00, 30), timezone offsets (+05, -07), or very short
		// segments that are unlikely to be field names.
		if !looksLikeValueContinuation(nextWord) {
			break
		}
		p.advance() // consume ':'
		p.advance() // consume word
		val += ":" + nextWord
	}

	// Detect wildcard.
	if op == OpEquals && strings.Contains(val, "*") {
		op = OpWildcard
	}

	return &QueryNode{
		Field: fieldTok.val,
		Op:    op,
		Value: val,
	}, nil
}

// looksLikeValueContinuation returns true when a word token that follows a
// colon inside a value position appears to be a continuation of the value
// (e.g. a time component "00", "30") rather than a new field name.
func looksLikeValueContinuation(word string) bool {
	if len(word) == 0 {
		return false
	}
	// Pure digits (time components like "00", "30", "2026").
	allDigits := true
	for _, r := range word {
		if !unicode.IsDigit(r) {
			allDigits = false
			break
		}
	}
	if allDigits {
		return true
	}
	// Digit sequences with dots or hyphens (dates or fractional seconds).
	looksNumericish := true
	for _, r := range word {
		if !unicode.IsDigit(r) && r != '.' && r != '-' && r != '+' {
			looksNumericish = false
			break
		}
	}
	return looksNumericish
}

// --------------------------------------------------------------------------
// ClickHouse SQL generation
// --------------------------------------------------------------------------

// ToClickHouseWhere converts a QueryNode tree into a ClickHouse WHERE clause
// fragment and positional parameter values.  Field names are mapped through
// KnownFields; unknown fields are used verbatim (allowing direct column
// references).
func (q *QueryNode) ToClickHouseWhere() (string, []interface{}) {
	if q == nil {
		return "1=1", nil
	}
	sql, params := q.toSQL()
	return sql, params
}

func (q *QueryNode) toSQL() (string, []interface{}) {
	// Branch node.
	if !q.IsLeaf() {
		switch q.BoolOp {
		case BoolNot:
			childSQL, childParams := q.Children[0].toSQL()
			return fmt.Sprintf("NOT (%s)", childSQL), childParams
		case BoolAnd:
			return q.binarySQL("AND")
		case BoolOr:
			return q.binarySQL("OR")
		}
	}

	// Leaf: fulltext.
	if q.Op == OpFullText {
		return "raw_text ILIKE ?", []interface{}{"%" + escapeLikePattern(q.Value) + "%"}
	}

	// Resolve column name.
	col := resolveColumn(q.Field)

	switch q.Op {
	case OpEquals:
		return fmt.Sprintf("%s = ?", col), []interface{}{q.Value}
	case OpNotEquals:
		return fmt.Sprintf("%s != ?", col), []interface{}{q.Value}
	case OpGreaterThan:
		return fmt.Sprintf("%s > ?", col), []interface{}{castParam(col, q.Value)}
	case OpGreaterEqual:
		return fmt.Sprintf("%s >= ?", col), []interface{}{castParam(col, q.Value)}
	case OpLessThan:
		return fmt.Sprintf("%s < ?", col), []interface{}{castParam(col, q.Value)}
	case OpLessEqual:
		return fmt.Sprintf("%s <= ?", col), []interface{}{castParam(col, q.Value)}
	case OpWildcard:
		// Escape SQL LIKE metacharacters (% and _) in the user value before
		// converting KQL wildcards (*) to SQL wildcards (%).
		escaped := escapeLikePattern(q.Value)
		pattern := strings.ReplaceAll(escaped, "*", "%")
		return fmt.Sprintf("%s ILIKE ?", col), []interface{}{pattern}
	default:
		return fmt.Sprintf("%s = ?", col), []interface{}{q.Value}
	}
}

// escapeLikePattern escapes the SQL LIKE metacharacters % and _ so they are
// treated as literals. Backslash is used as the escape character (the
// ClickHouse default for ILIKE/LIKE).
func escapeLikePattern(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}

// binarySQL generates SQL for a two-child boolean node.
func (q *QueryNode) binarySQL(op string) (string, []interface{}) {
	leftSQL, leftParams := q.Children[0].toSQL()
	rightSQL, rightParams := q.Children[1].toSQL()
	params := append(leftParams, rightParams...)
	return fmt.Sprintf("(%s %s %s)", leftSQL, op, rightSQL), params
}

// resolveColumn maps a KQL field name to its ClickHouse column name.
func resolveColumn(field string) string {
	lower := strings.ToLower(field)
	if col, ok := KnownFields[lower]; ok {
		return col
	}
	return field
}

// castParam returns the value as-is for string columns, but attempts to keep
// numeric values as strings for the ClickHouse driver to handle type
// conversion. For numeric columns the raw string is returned and ClickHouse
// will cast it.
func castParam(col, value string) interface{} {
	// The ClickHouse Go driver handles string-to-numeric coercion for
	// parameterized queries, so we always pass the raw string. This keeps
	// the parser free of type-conversion errors; invalid values will be
	// caught at query execution time.
	_ = col
	return value
}

// --------------------------------------------------------------------------
// Bleve query generation
// --------------------------------------------------------------------------

// ToBleveQuery converts a QueryNode tree into a bleve.Query for full-text
// search. If the node is nil, a MatchAllQuery is returned.
func ToBleveQuery(node *QueryNode) bleveQuery.Query {
	if node == nil {
		return bleve.NewMatchAllQuery()
	}
	return nodeToBleveQuery(node)
}

// nodeToBleveQuery recursively converts a single QueryNode to a bleve query.
func nodeToBleveQuery(node *QueryNode) bleveQuery.Query {
	// Branch nodes: boolean combinators.
	if !node.IsLeaf() {
		switch node.BoolOp {
		case BoolAnd:
			conjuncts := make([]bleveQuery.Query, 0, len(node.Children))
			for _, child := range node.Children {
				conjuncts = append(conjuncts, nodeToBleveQuery(child))
			}
			return bleve.NewConjunctionQuery(conjuncts...)

		case BoolOr:
			disjuncts := make([]bleveQuery.Query, 0, len(node.Children))
			for _, child := range node.Children {
				disjuncts = append(disjuncts, nodeToBleveQuery(child))
			}
			return bleve.NewDisjunctionQuery(disjuncts...)

		case BoolNot:
			// NOT is expressed as a boolean query with a must_not clause.
			child := nodeToBleveQuery(node.Children[0])
			boolQ := bleve.NewBooleanQuery()
			boolQ.AddMustNot(child)
			boolQ.AddMust(bleve.NewMatchAllQuery())
			return boolQ
		}
	}

	// Leaf nodes: field filters and full-text search.
	switch node.Op {
	case OpFullText:
		q := bleve.NewMatchQuery(node.Value)
		return q

	case OpEquals:
		col := resolveColumn(node.Field)
		// For keyword fields use a term query (exact match).
		q := bleve.NewTermQuery(node.Value)
		q.SetField(col)
		return q

	case OpNotEquals:
		col := resolveColumn(node.Field)
		inner := bleve.NewTermQuery(node.Value)
		inner.SetField(col)
		boolQ := bleve.NewBooleanQuery()
		boolQ.AddMustNot(inner)
		boolQ.AddMust(bleve.NewMatchAllQuery())
		return boolQ

	case OpWildcard:
		col := resolveColumn(node.Field)
		q := bleve.NewWildcardQuery(node.Value)
		q.SetField(col)
		return q

	case OpGreaterThan:
		return buildNumericRangeQuery(node, false, true)

	case OpGreaterEqual:
		return buildNumericRangeQuery(node, true, true)

	case OpLessThan:
		return buildNumericRangeQuery(node, false, false)

	case OpLessEqual:
		return buildNumericRangeQuery(node, true, false)

	default:
		// Fallback: match query on the value.
		q := bleve.NewMatchQuery(node.Value)
		return q
	}
}

// buildNumericRangeQuery creates a numeric range query from a QueryNode.
// inclusive controls whether the boundary is inclusive, isMin determines
// whether the value is a minimum or maximum bound.
func buildNumericRangeQuery(node *QueryNode, inclusive bool, isMin bool) bleveQuery.Query {
	col := resolveColumn(node.Field)
	val, err := strconv.ParseFloat(node.Value, 64)
	if err != nil {
		// If the value is not numeric, fall back to a match query.
		q := bleve.NewMatchQuery(node.Value)
		q.SetField(col)
		return q
	}

	var minVal, maxVal *float64
	var minInclusive, maxInclusive *bool

	if isMin {
		minVal = &val
		minInclusive = &inclusive
	} else {
		maxVal = &val
		maxInclusive = &inclusive
	}

	q := bleve.NewNumericRangeInclusiveQuery(minVal, maxVal, minInclusive, maxInclusive)
	q.SetField(col)
	return q
}
