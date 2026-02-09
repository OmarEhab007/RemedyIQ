# ARLogAnalyzer: AI-Powered BMC Remedy Log Analysis Platform

**Design Document | February 2026**

---

## Table of Contents
1. AI Skills for Log Analysis
2. Natural Language Query Interface
3. Anomaly Detection Engine
4. Root Cause Analysis Engine
5. Intelligent Alerting System
6. Report Generation
7. Claude API Integration Architecture
8. RAG Implementation for Logs

---

## 1. AI "SKILLS" FOR LOG ANALYSIS

### Overview
Design a modular system where each "skill" is a specialized AI capability that admins can invoke to analyze specific aspects of Remedy logs.

### 1.1 Skill Architecture

**Base Skill Structure:**
```
{
  "id": "skill_id",
  "name": "Skill Display Name",
  "category": "performance|security|configuration|health",
  "description": "What this skill does",
  "inputs": {
    "log_type": "arapi|arsql|arfilter|aresc",
    "time_range": "duration",
    "filters": "optional query filters",
    "params": "skill-specific parameters"
  },
  "outputs": {
    "findings": "array of structured insights",
    "metrics": "quantitative results",
    "recommendations": "actionable suggestions",
    "severity": "info|warning|critical"
  },
  "execution_mode": "streaming|batch",
  "cost_estimate": "tokens|runtime"
}
```

### 1.2 The 15-20 Core Skills

#### **PERFORMANCE CATEGORY**

**Skill 1: API Response Time Analysis**
- **Purpose**: Identify slow API calls and performance degradation patterns
- **Input**: arapi.log, time range, optional service/user filter
- **Processing**:
  - Extract all API calls with execution times
  - Calculate percentiles (p50, p95, p99)
  - Detect calls exceeding thresholds (>1s = warning, >5s = critical)
  - Correlate with concurrent request volume
- **Output**:
  - Slowest API operations by count and percentile
  - Time range of peak latency
  - Correlation with request volume
  - Top 5 offenders with historical trend
- **Related LLM Task**: Explain performance degradation patterns; identify which operations regressed

**Skill 2: SQL Query Performance Profiling**
- **Purpose**: Detect slow database queries and query plan regressions
- **Input**: arsql.log, time range, optional table/query pattern
- **Processing**:
  - Parse SQL execution times from logs
  - Calculate baseline performance (moving average of last 7 days)
  - Identify queries >2x baseline as regressions
  - Count query frequency for high-impact analysis
  - Detect full table scans vs. indexed queries
- **Output**:
  - Slowest SQL queries by duration and frequency
  - Query plan regression indicators
  - Estimated improvement if optimized (time saved)
  - Table scan warnings
- **Related LLM Task**: Suggest optimization strategies; identify missing indexes

**Skill 3: Filter Execution Bottleneck Detection**
- **Purpose**: Find filters causing performance issues
- **Input**: arfilter.log, time range, optional filter name pattern
- **Processing**:
  - Extract filter execution times
  - Identify cascading filter chains (A → B → C)
  - Measure cumulative execution time per transaction
  - Detect filter runaway (execution time > 30s)
  - Calculate filter impact on overall transaction time
- **Output**:
  - Longest-running filters
  - Filter cascade depth and total time
  - Percentage of transaction time spent in filtering
  - Filters causing >100ms per execution
- **Related LLM Task**: Identify filter inefficiencies; suggest consolidation opportunities

**Skill 4: Escalation Processing Timeline**
- **Purpose**: Analyze escalation trigger timing and execution
- **Input**: aresc.log, time range, optional escalation type
- **Processing**:
  - Parse escalation trigger events
  - Measure time from trigger to execution
  - Identify delayed escalations (>threshold)
  - Count escalation frequency by type
  - Detect escalations that created loops
- **Output**:
  - Average escalation delay
  - Most frequently triggered escalations
  - Failed or looped escalations
  - Peak escalation activity windows
- **Related LLM Task**: Explain escalation delays; suggest process improvements

---

#### **ANOMALY & PATTERN CATEGORY**

**Skill 5: API Error Rate Anomaly Detection**
- **Purpose**: Identify unusual error spikes in API logs
- **Input**: arapi.log, time range, baseline period (default: last 30 days)
- **Processing**:
  - Count errors per minute/hour
  - Calculate baseline mean and stddev from historical data
  - Apply Z-score analysis (threshold: |Z| > 2.5)
  - Categorize errors by type (auth, validation, server, timeout)
  - Identify error bursts
- **Output**:
  - Anomalous error periods with statistical confidence
  - Error type breakdown for anomaly window
  - Anomaly severity score (0-100)
  - Comparison to baseline
- **Related LLM Task**: Explain what caused the error spike; correlate with other log types

**Skill 6: SQL Query Volume Spike Detection**
- **Purpose**: Identify unusual database activity patterns
- **Input**: arsql.log, time range, baseline period (default: last 30 days)
- **Processing**:
  - Count queries per minute
  - Calculate baseline from historical window
  - Apply Interquartile Range (IQR) method for outliers
  - Segment by query type (SELECT, INSERT, UPDATE, DELETE)
  - Detect sustained elevation vs. brief spikes
- **Output**:
  - Spike periods with magnitude (e.g., 3x normal)
  - Query type distribution during spike
  - Spike duration and total query count
  - Most frequent queries during anomaly
- **Related LLM Task**: Hypothesize spike cause; suggest investigation steps

**Skill 7: Response Time Distribution Shift**
- **Purpose**: Detect when latency profile changes (e.g., more p95 tail latency)
- **Input**: arapi.log or arsql.log, time range, control period
- **Processing**:
  - Calculate response time percentiles for control and test periods
  - Compare p50, p95, p99 distributions
  - Apply Kolmogorov-Smirnov test for distribution shift
  - Identify if shift is from baseline increase or variance increase
- **Output**:
  - Statistical significance of shift
  - Affected percentiles
  - New latency profile vs. baseline
  - Estimated impact on user experience
- **Related LLM Task**: Explain which system changes correlate with distribution shift

**Skill 8: Seasonal Pattern Recognition**
- **Purpose**: Identify daily, weekly, monthly patterns in system behavior
- **Input**: Any log type, historical data (>7 days), time range to analyze
- **Processing**:
  - Extract hourly/daily metrics (request count, error rate, latency)
  - Apply FFT (Fast Fourier Transform) for periodicity detection
  - Identify dominant frequencies (daily, weekly cycles)
  - Detect deviations from expected seasonal pattern
  - Forecast expected values for upcoming period
- **Output**:
  - Identified seasonal periods
  - Expected vs. actual metrics for date range
  - Anomalies relative to seasonal pattern
  - Confidence in seasonal model
- **Related LLM Task**: Explain why seasonal pattern deviated; predict next week's behavior

**Skill 9: Filter Cascade Storm Detection**
- **Purpose**: Identify runaway filter execution chains
- **Input**: arfilter.log + arapi.log, time range
- **Processing**:
  - Parse filter execution graph from logs
  - Build dependency chain (Filter A → Filter B → Filter C)
  - Detect circular dependencies or excessive nesting (depth > 5)
  - Measure cumulative execution time > transaction time (indicates loops)
  - Identify filters triggered repeatedly without output change
- **Output**:
  - Detected cascade storms with involved filters
  - Cycle depth and frequency
  - Estimated time wasted
  - Affected transactions
- **Related LLM Task**: Explain cascade mechanism; suggest filter redesign

---

#### **DIAGNOSTIC CATEGORY**

**Skill 10: API-to-SQL Call Chain Correlation**
- **Purpose**: Trace an API request through to its SQL queries
- **Input**: arapi.log + arsql.log, time range, optional API operation/transaction ID
- **Processing**:
  - Extract request IDs/transaction IDs from API logs
  - Match to SQL queries with same transaction context
  - Build call graph (API → Filters → SQL)
  - Calculate time spent at each layer
  - Identify which SQL query dominates latency
- **Output**:
  - Call flow diagram data (API → Filter → SQL)
  - Time breakdown by layer
  - Slowest contributor (SQL query, filter, or API overhead)
  - Full execution trace
- **Related LLM Task**: Explain the bottleneck in plain language; identify optimization target

**Skill 11: Error Propagation Trace**
- **Purpose**: Trace where errors originate and how they propagate
- **Input**: All log types, time range, specific error type or message pattern
- **Processing**:
  - Find initial error occurrence in arapi.log
  - Correlate to arfilter.log and arsql.log using transaction ID
  - Determine error origin point (API, Filter, SQL, Escalation)
  - Trace subsequent errors from same transaction
  - Identify error recovery behavior
- **Output**:
  - Error source identification
  - Error propagation path
  - Related errors in same transaction
  - Time from error to recovery
- **Related LLM Task**: Explain error context; suggest fixes

**Skill 12: Configuration Change Impact**
- **Purpose**: Identify log anomalies coinciding with configuration changes
- **Input**: All logs, time range, configuration change timestamp
- **Processing**:
  - Establish baseline metrics before change
  - Measure metrics after change
  - Apply statistical test (t-test) for change significance
  - Quantify impact on latency, errors, volume
  - Identify which log type shows impact
- **Output**:
  - Impact assessment (positive/negative/neutral)
  - Affected metrics with before/after comparison
  - Statistical confidence
  - Rollback recommendation (if negative impact)
- **Related LLM Task**: Explain change impact; recommend configuration tuning

---

#### **INSIGHT & PREDICTION CATEGORY**

**Skill 13: Resource Contention Detection**
- **Purpose**: Identify when system resources (connection pools, memory, threads) are constrained
- **Input**: arapi.log + arsql.log, time range
- **Processing**:
  - Correlation analysis: when API latency increases, do SQL query times increase?
  - Detect connection pool exhaustion (queued requests > threshold)
  - Identify timeout patterns (suggests resource starvation)
  - Measure request queue depth over time
  - Identify peak resource utilization periods
- **Output**:
  - Resource contention periods
  - Contention severity (mild/moderate/severe)
  - Estimated capacity headroom
  - Recommendations for scaling
- **Related LLM Task**: Suggest capacity planning strategy; recommend optimization priority

**Skill 14: Performance Degradation Forecasting**
- **Purpose**: Predict when system will hit performance thresholds
- **Input**: Historical metrics (>30 days), current trend, growth rate
- **Processing**:
  - Extract time-series of response times, error rates, volume
  - Fit linear/polynomial trend model
  - Calculate growth rate (% per week)
  - Project when key metrics exceed thresholds
  - Estimate when critical degradation occurs
- **Output**:
  - Forecasted critical event date
  - Metric projection (p99 latency in 30 days)
  - Confidence interval
  - Days until action needed
- **Related LLM Task**: Explain forecasting; suggest proactive measures

**Skill 15: User Experience Impact Assessment**
- **Purpose**: Translate technical metrics to business impact
- **Input**: API response times, error rates, time range
- **Processing**:
  - Map latency to user experience categories:
    - 0-100ms: Excellent
    - 100-500ms: Good
    - 500-2000ms: Acceptable
    - 2000ms+: Poor
  - Calculate percentage of requests in each category
  - Estimate number of affected users
  - Compute loss of productivity (if applicable)
- **Output**:
  - UX health score (0-100)
  - Percentage users experiencing poor performance
  - Estimated business impact statement
  - Trend direction
- **Related LLM Task**: Summarize impact for stakeholders; justify investment in fix

---

#### **ADVANCED DIAGNOSTIC SKILLS**

**Skill 16: Database Query Plan Regression Analysis**
- **Purpose**: Detect when query execution plans changed causing performance degradation
- **Input**: arsql.log (with plan details), time range, historical window
- **Processing**:
  - Extract execution plans from logs
  - Compare plans for same query across time periods
  - Identify index changes or plan shifts
  - Correlate plan changes with latency changes
  - Calculate regression magnitude
- **Output**:
  - Affected queries with plan changes
  - Before/after performance comparison
  - Regression severity ranking
  - Recommended corrective actions
- **Related LLM Task**: Explain plan change cause; suggest optimizer hints or index creation

**Skill 17: Lock Contention and Deadlock Analysis**
- **Purpose**: Identify database locking issues from logs
- **Input**: arsql.log, time range
- **Processing**:
  - Detect lock timeout messages
  - Identify deadlock patterns
  - Correlate to tables/queries involved
  - Measure frequency and impact duration
  - Detect retry storms (failed transaction -> retry -> fail again)
- **Output**:
  - Lock contention hotspots
  - Deadlock victims and perpetrators
  - Frequency and cost estimation
  - Transaction isolation level recommendations
- **Related LLM Task**: Suggest lock contention mitigation; recommend query restructuring

**Skill 18: Memory Leak Detection**
- **Purpose**: Identify potential memory leaks in filter processing
- **Input**: arfilter.log + arapi.log, long time range (>7 days)
- **Processing**:
  - Extract memory usage patterns if available in logs
  - Look for monotonic increase in baseline metrics
  - Detect whether issue clears on restart
  - Correlate to specific filter or API operation
- **Output**:
  - Suspected memory leak indicators
  - Leaking component identification
  - Severity assessment
  - Restart frequency requirement
- **Related LLM Task**: Explain memory leak pattern; suggest code review focus areas

**Skill 19: Concurrency Bottleneck Identification**
- **Purpose**: Detect serialization points and concurrency limits
- **Input**: arapi.log + arfilter.log, time range with high concurrent activity
- **Processing**:
  - Analyze transaction interleaving patterns
  - Detect when increasing parallelism doesn't improve throughput
  - Identify serialized resources (locks, queues, connection pools)
  - Measure effective parallelism vs. theoretical max
- **Output**:
  - Bottleneck location and resource
  - Parallelism utilization percentage
  - Improvement potential if bottleneck removed
  - Recommended approach (async, pooling, etc.)
- **Related LLM Task**: Explain concurrency model; suggest architectural changes

**Skill 20: Data Quality and Log Completeness Check**
- **Purpose**: Assess log quality to ensure analysis reliability
- **Input**: Any log type, time range
- **Processing**:
  - Check for gaps in log timestamps
  - Verify required fields are populated
  - Detect log rotation/truncation points
  - Identify incomplete records
  - Measure correlation between log types (do API logs match filter logs by transaction ID?)
- **Output**:
  - Data quality score (0-100)
  - Missing data periods
  - Impact on analysis reliability
  - Recommendations for better logging
- **Related LLM Task**: Flag unreliable analysis results; suggest data collection improvements

---

## 2. NATURAL LANGUAGE QUERY INTERFACE

### 2.1 Architecture Overview

A three-layer system converting natural language to structured log queries:

```
Natural Language Input
    ↓
[NL Parser + Intent Recognition] (Claude + Structured Outputs)
    ↓
[Query Translator] (Claude Tool Use → Log Query DSL)
    ↓
[Query Executor] (Search logs, retrieve results)
    ↓
[Response Generator] (Claude → Natural Language Summary)
    ↓
Natural Language Output + Suggestions
```

### 2.2 Intent Recognition

**Supported Query Intent Categories:**

| Intent | Examples | Output |
|--------|----------|--------|
| **Performance Investigation** | "Why are API calls slow?", "Show me slowest SQL queries" | Skill: API Response Time Analysis + SQL Query Performance |
| **Error Analysis** | "What errors happened today?", "Why did requests fail at 3pm?" | Skill: API Error Rate Anomaly + Error Propagation Trace |
| **Anomaly Hunting** | "Is something wrong?", "Show me unusual activity" | Skill: Multiple anomaly skills based on log types available |
| **Trend Analysis** | "How has performance changed this week?", "Is error rate trending up?" | Skill: Performance Degradation Forecasting + Response Time Distribution Shift |
| **Comparison** | "Compare Monday vs Friday performance", "Is this slower than last week?" | Skill: Seasonal Pattern Recognition + Configuration Change Impact |
| **Prediction** | "When will we hit capacity?", "Will the system handle this load?" | Skill: Performance Degradation Forecasting + Resource Contention |
| **Root Cause** | "What caused the error spike?", "Why did performance degrade?" | Skill: API-to-SQL Call Chain Correlation + Configuration Change Impact |
| **Optimization** | "How can we improve performance?", "What's the fastest fix?" | Skill: SQL Query Performance + Filter Execution Bottleneck |
| **Status Summary** | "How is the system health?", "What happened in the last 24 hours?" | Skill: User Experience Impact Assessment + Data Quality Check |

### 2.3 Natural Language Query Examples (Remedy-Specific)

**Example 1: Performance Investigation**
```
User Query: "Why are ticket modification requests taking so long today?"

NL Parser Output:
{
  "intent": "performance_investigation",
  "domain": "remedy",
  "entity": "ticket_modification_requests",
  "time_period": "today",
  "entity_type": "api_operation"
}

Generated Skills Query:
- Skill: API Response Time Analysis
  - Filter: operations matching "ticket modification"
  - Time: today
  - Output: Slowest operations, latency trend

- Skill: API-to-SQL Call Chain Correlation
  - Filter: same operations
  - Output: Which SQL queries are slow

LLM Response:
"Ticket modification requests averaged 2.5 seconds today (normal is 0.3s).
The slowest query is updating the 'ticket_notes' field, which involves
4 escalations and 3 filter chains. Query 'UPDATE ticket_notes' is spending
1.8s due to a missing index on the timestamp field. I recommend creating
an index: CREATE INDEX idx_ticket_notes_timestamp ON ticket_notes(timestamp)."
```

**Example 2: Error Root Cause**
```
User Query: "We got error spike at 14:30 with 'Invalid field reference' - why?"

NL Parser Output:
{
  "intent": "root_cause",
  "entity": "error_message",
  "error_type": "Invalid field reference",
  "time_window": {
    "start": "14:30",
    "end": "14:45"
  }
}

Generated Skills Query:
- Skill: Error Propagation Trace
  - Filter: error message = "Invalid field reference"
  - Time: 14:30-14:45
  - Output: Error source, affected transactions

- Skill: Configuration Change Impact
  - Filter: changes deployed before 14:30
  - Output: Impact correlation

LLM Response:
"The error originated from Filter 'ValidateTicketFields' which was changed
at 14:20 to use a new field mapping. The new mapping is missing
'CustomerID' field which 2,400 ticket modifications required. Reverting
the filter or adding CustomerID to the mapping will resolve this."
```

**Example 3: Capacity Planning**
```
User Query: "We're growing 5% per week - when will we need to scale?"

NL Parser Output:
{
  "intent": "prediction",
  "metric_type": "capacity",
  "growth_rate": "5% per week",
  "threshold_type": "performance_degradation"
}

Generated Skills Query:
- Skill: Performance Degradation Forecasting
  - Growth rate: 5% weekly
  - Critical threshold: p99 latency > 5s
  - Timeframe: 90 days

LLM Response:
"Based on current growth of 5% weekly, your p99 API latency will exceed
5 seconds in approximately 12 weeks (mid-May). Your current p99 is 1.2s
and growing 0.08s per week. Recommendation: Scale database connections
by 50% within 8 weeks, or implement query result caching to reduce load."
```

### 2.4 Context-Aware Follow-Up Suggestions

After answering a query, the system generates suggested follow-ups based on findings:

**Rules for Follow-Up Generation:**

1. **If Performance Issue Found**: "Would you like to see [specific slow component]'s historical trend?"
2. **If Anomaly Detected**: "This differs from [baseline metric]. Should I investigate [related system]?"
3. **If Error Spike Found**: "The error spike started at [time]. Did you deploy changes around then?"
4. **If Optimization Opportunity Found**: "This could be fixed with [specific action]. Should I estimate the improvement?"
5. **If Time-Range Ambiguous**: "I'm analyzing [time range]. Would you like me to expand to [longer period]?"

**Example Follow-Ups:**
```
Initial Query: "Why are API calls slow?"
Finding: API calls are 3x slower than baseline due to SQL queries

Generated Follow-Ups:
1. "When did this SQL degradation start? Should I show the timeline?"
2. "Which specific SQL queries are slowest? Want the top 5?"
3. "Did this correlate with recent deployment or config change?"
4. "Would you like specific SQL optimization recommendations?"
5. "Are errors also elevated? Should I check for cascading issues?"
```

### 2.5 Remedy-Specific Query Patterns

**Pattern 1: Workflow Analysis**
```
"Is the [workflow name] workflow broken?"
→ Extracts workflow from logs → Checks all filters in workflow → Checks all SQL queries
→ Returns: filter success rates, SQL performance, error correlation
```

**Pattern 2: User Impact**
```
"How many users were affected by [issue description]?"
→ Correlates logs by user session → Estimates affected user count
→ Calculates: transactions failed, transaction success rate, error messages
```

**Pattern 3: Integration Health**
```
"How healthy is [integration name] integration?"
→ Filters logs by integration identifier → Checks API call success rate
→ Monitors: response times, error frequency, throughput
→ Returns: integration health score, trend direction
```

---

### 2.6 Implementation: NL Query to Log Query DSL

**Step 1: Extract Intent and Entities**
```python
def parse_natural_language(query: str) -> dict:
    """
    Use Claude with structured outputs to extract:
    - intent (from intent categories)
    - entities (what they're asking about)
    - time_period (when)
    - filters (any additional constraints)
    """
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        thinking={
            "type": "enabled",
            "budget_tokens": 5000
        },
        messages=[{
            "role": "user",
            "content": f"""Parse this Remedy log query into structured format:
"{query}"

Extract:
1. intent: one of {INTENT_CATEGORIES}
2. entity: what they're asking about
3. entity_type: api_operation|error|filter|sql_query|integration|workflow|user
4. time_period: {{'value': number, 'unit': 'hours'|'days'|'weeks'}}
5. log_types_needed: list of arapi|arsql|arfilter|aresc
6. severity_filter: info|warning|critical|all
7. confidence: 0.0-1.0 how sure you are about this parse"""
        }],
        system="""You are a BMC Remedy AR System expert.
You understand the domain-specific terminology.
Extract structured query parameters from natural language."""
    )
    return parse_structured_output(response)
```

**Step 2: Map to Skills**
```python
def map_intent_to_skills(parsed: dict) -> List[str]:
    """
    Based on intent and entity_type, select appropriate skills.

    Returns list of skill IDs to execute.
    """
    skill_mapping = {
        ("performance_investigation", "api_operation"):
            ["skill_api_response_time", "skill_api_sql_chain"],
        ("performance_investigation", "filter"):
            ["skill_filter_bottleneck", "skill_filter_cascade_storm"],
        ("error_analysis", "*"):
            ["skill_api_error_anomaly", "skill_error_propagation"],
        ("root_cause", "*"):
            ["skill_error_propagation", "skill_api_sql_chain"],
        # ... more mappings
    }

    key = (parsed['intent'], parsed['entity_type'])
    return skill_mapping.get(key, skill_mapping.get((key[0], '*'), []))
```

**Step 3: Generate Log Query DSL**
```python
def generate_log_query_dsl(skill_id: str, parsed: dict) -> str:
    """
    Use Claude tool_use to generate structured log query.

    Example DSL:
    SELECT api_call_id, operation, duration_ms, timestamp
    FROM arapi_log
    WHERE timestamp >= NOW() - INTERVAL 24h
      AND operation LIKE '%ticket%modification%'
      AND duration_ms > 1000
    ORDER BY duration_ms DESC
    LIMIT 100
    """

    response = client.messages.create(
        model="claude-opus-4-6",
        tools=[{
            "name": "generate_query",
            "description": "Generate log query DSL",
            "input_schema": {
                "type": "object",
                "properties": {
                    "log_source": {
                        "type": "string",
                        "enum": ["arapi", "arsql", "arfilter", "aresc"]
                    },
                    "select_fields": {"type": "array"},
                    "where_conditions": {"type": "array"},
                    "order_by": {"type": "string"},
                    "limit": {"type": "integer"}
                }
            }
        }],
        messages=[{
            "role": "user",
            "content": f"""Generate a log query for:
Skill: {skill_id}
Intent: {parsed['intent']}
Entity: {parsed['entity']}
Time Period: {parsed['time_period']}
Filters: {parsed.get('additional_filters', {})}"""
        }]
    )

    return extract_tool_use_result(response)
```

---

## 2.7 Comparison with Industry Solutions

| Platform | NL Query Capability | How It Works | Limitations |
|----------|-------------------|--------------|------------|
| **Datadog** | NLQ for Logs | LLM (Llama) translates NL → DQL queries | Only logs, no context about relationships |
| **New Relic** | AIOps + NRQL | Natural phrasing but still requires SQL concepts | Requires understanding of metrics structure |
| **Dynatrace** | Davis AI (RCA) | AI suggests root causes from relationships | Focused on correlation, not direct NL query |
| **ARLogAnalyzer** (This Design) | Intent-based Skills | NL → Intent → Skills → Multi-log Correlation | Remedy-specific, requires skill definition, more advanced |

**Key Advantage**: ARLogAnalyzer combines NL query with skill-based automation, allowing single query to invoke multiple analysis types with full context about Remedy system architecture.

---

## 3. ANOMALY DETECTION FOR REMEDY LOGS

### 3.1 Statistical Methods Overview

**Three-Tier Anomaly Detection Strategy:**

1. **Tier 1: Real-time Point Anomalies** (Z-score, IQR)
   - Detect sudden spikes in error rate, request volume
   - Latency: <100ms (streaming)
   - False positive rate: 1-5%

2. **Tier 2: Trend Anomalies** (Moving Average + Std Dev)
   - Detect sustained degradation over hours
   - Latency: 5-10 minutes
   - Catches gradual issues Tier 1 misses

3. **Tier 3: Distributional Anomalies** (KS Test, Drift Detection)
   - Detect when latency distribution shifts
   - Latency: 15-30 minutes
   - More sophisticated pattern recognition

### 3.2 Baseline Calculation Architecture

**Baseline Components:**
```
Baseline = {
  "mean": average metric value,
  "stddev": standard deviation,
  "percentiles": {p50, p75, p90, p95, p99},
  "seasonal_pattern": {hourly_pattern, daily_pattern, weekly_pattern},
  "trend": linear growth rate,
  "last_updated": timestamp,
  "confidence": 0.0-1.0,
  "data_points": count
}
```

**Baseline Calculation Method:**

```python
def calculate_baseline(metric_data: List[float],
                      time_period: str = "7_days",
                      exclude_outliers: bool = True) -> dict:
    """
    Calculate adaptive baseline with outlier handling.

    Args:
        metric_data: List of values (e.g., API latencies)
        time_period: "7_days" | "30_days" | "custom"
        exclude_outliers: Remove values outside 1.5*IQR

    Returns:
        Baseline dict with statistics and confidence
    """

    if exclude_outliers:
        Q1 = np.percentile(metric_data, 25)
        Q3 = np.percentile(metric_data, 75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        filtered_data = [x for x in metric_data
                        if lower_bound <= x <= upper_bound]
        confidence = len(filtered_data) / len(metric_data)
    else:
        filtered_data = metric_data
        confidence = 1.0

    baseline = {
        "mean": np.mean(filtered_data),
        "median": np.median(filtered_data),
        "stddev": np.std(filtered_data),
        "min": np.min(filtered_data),
        "max": np.max(filtered_data),
        "percentiles": {
            "p50": np.percentile(filtered_data, 50),
            "p75": np.percentile(filtered_data, 75),
            "p90": np.percentile(filtered_data, 90),
            "p95": np.percentile(filtered_data, 95),
            "p99": np.percentile(filtered_data, 99)
        },
        "data_points": len(filtered_data),
        "confidence": confidence
    }

    return baseline
```

### 3.3 Spike Detection Algorithms

**Algorithm 1: Z-Score Method (Real-time)**

```python
def detect_spike_zscore(value: float, baseline: dict,
                       threshold: float = 2.5) -> dict:
    """
    Detect point anomaly using Z-score.

    Z-score = (value - mean) / stddev

    |Z| > threshold indicates anomaly
    """

    if baseline["stddev"] == 0:
        return {"is_anomaly": False, "reason": "no_variance"}

    z_score = (value - baseline["mean"]) / baseline["stddev"]
    is_anomaly = abs(z_score) > threshold

    anomaly_severity = min(100, abs(z_score) * 25)  # 0-100 scale

    return {
        "is_anomaly": is_anomaly,
        "z_score": z_score,
        "severity": anomaly_severity,
        "deviation_from_mean": value - baseline["mean"],
        "pct_above_baseline": ((value - baseline["mean"]) / baseline["mean"] * 100)
            if baseline["mean"] > 0 else 0
    }
```

**Algorithm 2: Moving Average + Control Limits (Trending)**

```python
def detect_spike_moving_average(recent_values: List[float],
                               window_size: int = 10,
                               threshold_stddev: float = 2.0) -> dict:
    """
    Detect anomalies using moving average with control limits.

    Control limits = moving_avg ± (threshold_stddev * moving_stddev)
    """

    moving_avg = np.mean(recent_values[-window_size:])
    moving_stddev = np.std(recent_values[-window_size:])
    current_value = recent_values[-1]

    upper_limit = moving_avg + (threshold_stddev * moving_stddev)
    lower_limit = moving_avg - (threshold_stddev * moving_stddev)

    is_anomaly = (current_value > upper_limit or
                 current_value < lower_limit)

    return {
        "is_anomaly": is_anomaly,
        "moving_avg": moving_avg,
        "control_limits": (lower_limit, upper_limit),
        "severity": abs(current_value - moving_avg) / (moving_stddev + 1)
    }
```

**Algorithm 3: IQR Method (Robust to Outliers)**

```python
def detect_spike_iqr(value: float, baseline: dict,
                    multiplier: float = 1.5) -> dict:
    """
    Detect anomaly using Interquartile Range.

    Outliers: value < Q1 - multiplier*IQR or value > Q3 + multiplier*IQR
    """

    Q1 = baseline["percentiles"]["p25"]
    Q3 = baseline["percentiles"]["p75"]
    IQR = Q3 - Q1

    lower_bound = Q1 - multiplier * IQR
    upper_bound = Q3 + multiplier * IQR

    is_anomaly = (value < lower_bound or value > upper_bound)

    if value > upper_bound:
        anomaly_type = "HIGH"
        deviation = value - upper_bound
    elif value < lower_bound:
        anomaly_type = "LOW"
        deviation = lower_bound - value
    else:
        anomaly_type = "NONE"
        deviation = 0

    return {
        "is_anomaly": is_anomaly,
        "anomaly_type": anomaly_type,
        "bounds": (lower_bound, upper_bound),
        "deviation_from_bound": deviation
    }
```

### 3.4 Seasonal Pattern Recognition

**Method: Time-Series Decomposition + FFT**

```python
def detect_seasonal_patterns(metric_values: List[float],
                            timestamps: List[datetime],
                            min_period_hours: int = 24) -> dict:
    """
    Identify seasonal patterns using Fourier analysis.

    Steps:
    1. Resample data to hourly buckets
    2. Apply FFT to find dominant frequencies
    3. Identify periods that match known patterns (24h, 7d, 30d)
    4. Decompose series into: trend + seasonal + residual
    """

    # Resample to hourly
    hourly_data = resample_to_hourly(metric_values, timestamps)

    # Apply FFT
    fft_values = np.fft.fft(hourly_data)
    frequencies = np.fft.fftfreq(len(hourly_data))

    # Find dominant frequencies
    power = np.abs(fft_values)**2
    dominant_indices = np.argsort(power)[-5:]  # Top 5 frequencies

    # Convert frequency indices to periods (in hours)
    periods = []
    for idx in dominant_indices:
        if frequencies[idx] != 0:
            period_hours = 1 / abs(frequencies[idx])
            # Only keep periods > 24 hours (avoid noise)
            if period_hours > min_period_hours:
                periods.append({
                    "period_hours": period_hours,
                    "period_name": get_period_name(period_hours),
                    "power": power[idx],
                    "confidence": power[idx] / np.sum(power)
                })

    return {
        "detected_patterns": periods,
        "primary_pattern": periods[0] if periods else None,
        "seasonal_decomposition": {
            "trend": calculate_trend(hourly_data),
            "seasonal": calculate_seasonal(hourly_data, periods),
            "residual": calculate_residual(hourly_data, periods)
        }
    }

def get_period_name(hours: float) -> str:
    """Convert hours to readable period name."""
    if 20 < hours < 28:
        return "daily"
    elif 160 < hours < 176:  # 7 days
        return "weekly"
    elif 720 < hours < 744:  # 30 days
        return "monthly"
    else:
        return f"{hours:.1f}_hours"
```

**Anomaly Detection Using Seasonal Pattern:**

```python
def detect_anomaly_vs_seasonal(current_value: float,
                              seasonal_baseline: dict,
                              threshold_sigma: float = 2.5) -> dict:
    """
    Compare current value against expected seasonal value.

    Expected = seasonal_component[current_hour] + trend
    """

    expected_seasonal = seasonal_baseline["expected_value"]
    expected_stddev = seasonal_baseline["expected_stddev"]

    deviation = current_value - expected_seasonal
    z_score = deviation / (expected_stddev + 1)

    is_anomaly = abs(z_score) > threshold_sigma

    return {
        "is_anomaly": is_anomaly,
        "expected_value": expected_seasonal,
        "actual_value": current_value,
        "deviation": deviation,
        "pct_from_expected": (deviation / expected_seasonal * 100)
            if expected_seasonal > 0 else 0,
        "z_score": z_score,
        "severity": min(100, abs(z_score) * 25)
    }
```

### 3.5 Remedy-Specific Anomaly Patterns

**Pattern 1: Filter Cascade Storm**

```python
def detect_filter_cascade_storm(logs: List[dict],
                               time_window: int = 60) -> dict:
    """
    Detect runaway filter execution chains.

    Indicators:
    - Same filter appears in call stack >10 times
    - Cumulative filter time > transaction time
    - Filter output unchanged despite repeated execution
    """

    # Build call graphs for each transaction
    call_graphs = build_transaction_call_graphs(logs)

    storms = []
    for txn_id, graph in call_graphs.items():
        # Count filter occurrences
        filter_counts = count_node_occurrences(graph, "filter")

        # Check for cycles
        has_cycles = detect_cycles_in_graph(graph)

        # Measure cumulative execution time
        cumulative_time = sum_execution_times(graph)
        transaction_time = get_transaction_duration(txn_id, logs)

        if (max(filter_counts.values()) > 10 or
            has_cycles or
            cumulative_time > transaction_time * 2):

            storms.append({
                "transaction_id": txn_id,
                "involved_filters": [f for f, c in filter_counts.items() if c > 5],
                "repetition_count": max(filter_counts.values()),
                "cumulative_time_ms": cumulative_time,
                "transaction_time_ms": transaction_time,
                "overhead_pct": (cumulative_time / transaction_time - 1) * 100,
                "has_cycles": has_cycles
            })

    return {
        "cascade_storms_detected": len(storms),
        "storms": storms,
        "severity": "critical" if storms else "ok"
    }
```

**Pattern 2: SQL Query Plan Regression**

```python
def detect_sql_query_plan_regression(
    logs: List[dict],
    baseline_window_days: int = 7,
    threshold_multiplier: float = 1.5) -> dict:
    """
    Detect when SQL query execution plans change causing degradation.
    """

    # Extract queries and their performance
    baseline_queries = extract_queries_from_period(
        logs,
        days_back=baseline_window_days
    )
    recent_queries = extract_queries_from_period(
        logs,
        days_back=1
    )

    regressions = []
    for query_signature, recent_stats in recent_queries.items():
        if query_signature not in baseline_queries:
            continue

        baseline_stats = baseline_queries[query_signature]

        # Compare execution times
        baseline_p95 = baseline_stats["p95_duration_ms"]
        recent_p95 = recent_stats["p95_duration_ms"]

        if recent_p95 > baseline_p95 * threshold_multiplier:
            # Likely plan regression
            regressions.append({
                "query": query_signature,
                "baseline_p95_ms": baseline_p95,
                "current_p95_ms": recent_p95,
                "regression_pct": (recent_p95 / baseline_p95 - 1) * 100,
                "affected_executions": recent_stats["execution_count"],
                "total_time_wasted_ms":
                    recent_stats["execution_count"] *
                    (recent_p95 - baseline_p95),
                "old_plan": baseline_stats.get("execution_plan"),
                "new_plan": recent_stats.get("execution_plan")
            })

    return {
        "regressions_detected": len(regressions),
        "regressions": sorted(
            regressions,
            key=lambda x: x["total_time_wasted_ms"],
            reverse=True
        )[:10]  # Top 10 by impact
    }
```

---

## 4. ROOT CAUSE ANALYSIS (RCA) ENGINE

### 4.1 RCA Architecture

**Multi-Layer RCA System:**

```
Symptom Detection
(e.g., "API latency > 5s")
    ↓
Correlation Engine
(Link events across log types)
    ↓
Dependency Graph Construction
(Build cause-effect relationships)
    ↓
Hypothesis Generation
(Multiple root cause candidates)
    ↓
Evidence Collection
(Find supporting/refuting evidence)
    ↓
Root Cause Ranking
(Confidence scoring)
    ↓
LLM Narrative Generation
(Explain in plain language)
```

### 4.2 Correlation Engine: Linking Events Across Logs

**Four Correlation Dimensions:**

```python
class CorrelationEngine:

    def correlate_events(self, symptom: dict, time_window_sec: int = 5) -> dict:
        """
        Find related events in different log types that correlate with symptom.
        """

        # 1. Temporal Correlation
        temporal_matches = self.find_temporal_matches(
            symptom,
            time_window=time_window_sec
        )

        # 2. Transaction ID Correlation
        transaction_matches = self.find_by_transaction_id(
            symptom,
            exact_match=True
        )

        # 3. User/Session Correlation
        user_matches = self.find_by_user_session(
            symptom,
            time_window=time_window_sec
        )

        # 4. Resource Correlation
        # When API latency increases, do SQL times also increase?
        resource_matches = self.find_resource_contention_correlation(
            symptom,
            time_window=time_window_sec
        )

        return {
            "temporal": temporal_matches,
            "transaction": transaction_matches,
            "user": user_matches,
            "resource": resource_matches,
            "total_correlated_events": sum([
                len(temporal_matches),
                len(transaction_matches),
                len(user_matches),
                len(resource_matches)
            ])
        }

    def find_temporal_matches(self, symptom: dict,
                             time_window: int) -> List[dict]:
        """
        Find all events in [symptom_time - window, symptom_time + window].
        """
        symptom_time = symptom["timestamp"]

        # Check arapi logs
        api_events = self.query_logs(
            "arapi",
            f"timestamp BETWEEN {symptom_time - time_window} AND {symptom_time + time_window}"
        )

        # Check arsql logs
        sql_events = self.query_logs(
            "arsql",
            f"timestamp BETWEEN {symptom_time - time_window} AND {symptom_time + time_window}"
        )

        # Check arfilter logs
        filter_events = self.query_logs(
            "arfilter",
            f"timestamp BETWEEN {symptom_time - time_window} AND {symptom_time + time_window}"
        )

        return {
            "api_events": api_events,
            "sql_events": sql_events,
            "filter_events": filter_events
        }

    def find_by_transaction_id(self, symptom: dict,
                              exact_match: bool = True) -> List[dict]:
        """
        Find all events with same transaction/request ID.
        """
        txn_id = symptom.get("transaction_id") or symptom.get("request_id")

        if not txn_id:
            return {}

        return {
            "api_events": self.query_logs("arapi", f"transaction_id = {txn_id}"),
            "sql_events": self.query_logs("arsql", f"transaction_id = {txn_id}"),
            "filter_events": self.query_logs("arfilter", f"transaction_id = {txn_id}"),
            "escalation_events": self.query_logs("aresc", f"transaction_id = {txn_id}")
        }

    def find_resource_contention_correlation(self, symptom: dict,
                                            time_window: int) -> dict:
        """
        Analyze correlation between symptom and system resources.

        If API latency increases, check:
        - Did SQL query times increase? (suggests DB contention)
        - Did request volume increase? (suggests overload)
        - Did error rate increase? (suggests cascading failures)
        """

        symptom_time = symptom["timestamp"]
        symptom_metric = symptom["metric"]  # e.g., "api_latency"

        correlations = {}

        # Check SQL correlation
        sql_latency_before = self.get_metric_stats(
            "arsql",
            "duration_ms",
            start_time=symptom_time - time_window * 3,
            end_time=symptom_time - time_window
        )
        sql_latency_after = self.get_metric_stats(
            "arsql",
            "duration_ms",
            start_time=symptom_time,
            end_time=symptom_time + time_window * 3
        )

        sql_correlation = self.calculate_correlation(
            sql_latency_before,
            sql_latency_after
        )
        correlations["sql_latency_correlation"] = sql_correlation

        # Check volume correlation
        api_volume_before = self.get_metric_stats(
            "arapi",
            "request_count",
            start_time=symptom_time - time_window * 3,
            end_time=symptom_time - time_window
        )
        api_volume_after = self.get_metric_stats(
            "arapi",
            "request_count",
            start_time=symptom_time,
            end_time=symptom_time + time_window * 3
        )

        volume_increase = (api_volume_after["mean"] - api_volume_before["mean"]) / (api_volume_before["mean"] + 1)
        correlations["volume_increase"] = volume_increase

        # Check error rate correlation
        error_rate_before = self.get_metric_stats(
            "arapi",
            "error_rate",
            start_time=symptom_time - time_window * 3,
            end_time=symptom_time - time_window
        )
        error_rate_after = self.get_metric_stats(
            "arapi",
            "error_rate",
            start_time=symptom_time,
            end_time=symptom_time + time_window * 3
        )

        correlations["error_rate_increase"] = (
            error_rate_after["mean"] - error_rate_before["mean"]
        )

        return correlations
```

### 4.3 Dependency Graph Construction

**Graph Representation:**

```python
class DependencyGraph:
    """
    Represents call flow: API → Filter → SQL → API Result

    Nodes: API calls, filters, SQL queries, escalations
    Edges: Call relationships with latency annotations
    """

    def __init__(self):
        self.nodes = {}  # {node_id: node_data}
        self.edges = {}  # {source_id: {target_id: edge_data}}

    def build_from_logs(self, logs: List[dict],
                       transaction_id: str) -> None:
        """
        Build graph from logs for a single transaction.

        Process:
        1. Extract all events for transaction
        2. Order by timestamp
        3. Infer relationships:
           - API call triggers filters
           - Filter triggers SQL queries
           - SQL results returned to filter
           - Filter results returned to API
        """

        txn_events = [l for l in logs if l.get("transaction_id") == transaction_id]
        txn_events.sort(key=lambda x: x["timestamp"])

        for event in txn_events:
            # Create node
            node_id = f"{event['log_type']}_{event['event_id']}"
            self.nodes[node_id] = {
                "type": event["log_type"],  # api|filter|sql|esc
                "name": event.get("operation_name", event.get("query_name")),
                "timestamp": event["timestamp"],
                "duration_ms": event.get("duration_ms", 0),
                "status": event.get("status", "unknown"),
                "result": event.get("result"),
                "event_data": event
            }

        # Infer edges from temporal relationships
        for i, event1 in enumerate(txn_events):
            for event2 in txn_events[i+1:]:
                if self._should_connect(event1, event2):
                    source_id = f"{event1['log_type']}_{event1['event_id']}"
                    target_id = f"{event2['log_type']}_{event2['event_id']}"

                    if source_id not in self.edges:
                        self.edges[source_id] = {}

                    self.edges[source_id][target_id] = {
                        "latency_ms": event2["timestamp"] - event1["timestamp"],
                        "type": self._infer_edge_type(event1, event2)
                    }

                    # Don't connect beyond the direct next event
                    # (avoid long-range spurious connections)
                    break

    def find_critical_path(self) -> dict:
        """
        Find path through graph with highest total latency.
        Uses depth-first search.
        """

        # Start from API node
        api_nodes = [n for n, d in self.nodes.items() if d["type"] == "api"]

        max_path = None
        max_latency = 0

        for start in api_nodes:
            path = self._dfs_path(start, total_latency=0)
            if path["total_latency"] > max_latency:
                max_latency = path["total_latency"]
                max_path = path

        return max_path

    def _dfs_path(self, node_id: str,
                  visited: set = None,
                  total_latency: float = 0,
                  path: list = None) -> dict:
        """Depth-first search to find critical path."""

        if visited is None:
            visited = set()
        if path is None:
            path = []

        visited.add(node_id)
        path.append(node_id)

        # Get all children
        children = self.edges.get(node_id, {})

        if not children:
            # Leaf node
            return {
                "path": path,
                "total_latency": total_latency,
                "node_count": len(path)
            }

        # Recurse on children
        max_child_path = None
        for child_id, edge_data in children.items():
            if child_id not in visited:
                child_path = self._dfs_path(
                    child_id,
                    visited.copy(),
                    total_latency + edge_data["latency_ms"],
                    path.copy()
                )

                if max_child_path is None or child_path["total_latency"] > max_child_path["total_latency"]:
                    max_child_path = child_path

        return max_child_path or {
            "path": path,
            "total_latency": total_latency,
            "node_count": len(path)
        }

    def identify_bottlenecks(self) -> List[dict]:
        """Find nodes that account for significant latency."""

        critical_path = self.find_critical_path()
        total_latency = critical_path["total_latency"]

        bottlenecks = []
        for node_id in critical_path["path"]:
            node = self.nodes[node_id]
            latency = node["duration_ms"]

            if latency / total_latency > 0.1:  # >10% of total
                bottlenecks.append({
                    "node_id": node_id,
                    "node_name": node["name"],
                    "node_type": node["type"],
                    "latency_ms": latency,
                    "pct_of_total": (latency / total_latency) * 100,
                    "status": node["status"]
                })

        return sorted(bottlenecks,
                     key=lambda x: x["latency_ms"],
                     reverse=True)
```

### 4.4 Hypothesis Generation and Ranking

```python
class RCAnalyzer:
    """Root Cause Analysis Engine"""

    def generate_hypotheses(self, symptom: dict,
                           correlations: dict,
                           dependency_graph: DependencyGraph) -> List[dict]:
        """
        Generate ranked list of root cause hypotheses.

        Hypothesis scoring: evidence * relevance * specificity
        """

        hypotheses = []

        # Hypothesis 1: Database bottleneck
        if correlations["resource"]["sql_latency_correlation"] > 0.7:
            bottlenecks = dependency_graph.identify_bottlenecks()
            sql_bottlenecks = [b for b in bottlenecks if b["node_type"] == "sql"]

            if sql_bottlenecks:
                hypotheses.append({
                    "id": "hypothesis_sql_bottleneck",
                    "title": "Database Query Performance Degradation",
                    "description": f"SQL query '{sql_bottlenecks[0]['node_name']}' "
                                 f"is taking {sql_bottlenecks[0]['latency_ms']}ms, "
                                 f"which is {sql_bottlenecks[0]['pct_of_total']:.1f}% "
                                 f"of total transaction time",
                    "evidence": {
                        "sql_latency_increased": sql_bottlenecks[0]["latency_ms"],
                        "correlation_to_symptom": correlations["resource"]["sql_latency_correlation"],
                        "supporting_events": correlations["temporal"]["sql_events"]
                    },
                    "confidence": 0.85,
                    "impact": "high",
                    "remediation": [
                        f"Optimize query: {sql_bottlenecks[0]['node_name']}",
                        "Add missing indexes",
                        "Update statistics"
                    ]
                })

        # Hypothesis 2: Filter cascade/inefficiency
        filter_bottlenecks = [b for b in dependency_graph.identify_bottlenecks()
                            if b["node_type"] == "filter"]

        if filter_bottlenecks:
            hypotheses.append({
                "id": "hypothesis_filter_inefficiency",
                "title": f"Filter '{filter_bottlenecks[0]['node_name']}' Inefficiency",
                "description": f"Filter is spending {filter_bottlenecks[0]['latency_ms']}ms, "
                             f"{filter_bottlenecks[0]['pct_of_total']:.1f}% of total time",
                "evidence": {
                    "filter_latency": filter_bottlenecks[0]["latency_ms"],
                    "filter_impact_pct": filter_bottlenecks[0]["pct_of_total"]
                },
                "confidence": 0.75,
                "impact": "medium",
                "remediation": [
                    f"Review filter logic: {filter_bottlenecks[0]['node_name']}",
                    "Consider splitting filter",
                    "Move to database layer if possible"
                ]
            })

        # Hypothesis 3: Resource contention / overload
        if correlations["resource"]["volume_increase"] > 0.5:
            hypotheses.append({
                "id": "hypothesis_overload",
                "title": "System Overload - High Request Volume",
                "description": f"Request volume increased by {correlations['resource']['volume_increase']*100:.0f}%, "
                             "causing resource contention",
                "evidence": {
                    "volume_increase_pct": correlations["resource"]["volume_increase"] * 100,
                    "concurrent_requests": correlations["temporal"]["api_events"].__len__()
                },
                "confidence": 0.70,
                "impact": "medium",
                "remediation": [
                    "Scale additional capacity",
                    "Implement rate limiting",
                    "Optimize slow queries first"
                ]
            })

        # Hypothesis 4: Configuration change impact
        recent_changes = self.query_configuration_changes(
            before_time=symptom["timestamp"] - 3600,
            after_time=symptom["timestamp"]
        )

        if recent_changes:
            hypotheses.append({
                "id": "hypothesis_config_change",
                "title": "Performance Impact from Recent Configuration Change",
                "description": f"Configuration change deployed at {recent_changes[0]['timestamp']}: "
                             f"{recent_changes[0]['description']}",
                "evidence": {
                    "change_timestamp": recent_changes[0]["timestamp"],
                    "change_description": recent_changes[0]["description"],
                    "symptom_onset": symptom["timestamp"],
                    "time_correlation_sec": symptom["timestamp"] - recent_changes[0]["timestamp"]
                },
                "confidence": 0.65,
                "impact": "high",
                "remediation": [
                    f"Review change: {recent_changes[0]['description']}",
                    f"Revert if negative impact",
                    "A/B test change"
                ]
            })

        # Hypothesis 5: Error cascade
        if correlations["resource"]["error_rate_increase"] > 0.05:
            hypotheses.append({
                "id": "hypothesis_error_cascade",
                "title": "Error Cascade - Initial Failures Causing Widespread Issues",
                "description": f"Error rate increased by {correlations['resource']['error_rate_increase']*100:.1f}%, "
                             "cascading through system",
                "evidence": {
                    "error_rate_increase": correlations["resource"]["error_rate_increase"],
                    "error_messages": list(set([e.get("error_message") for e in correlations["temporal"]["api_events"]]))[:5]
                },
                "confidence": 0.60,
                "impact": "high",
                "remediation": [
                    "Investigate first/primary error",
                    "Add error handling/retry logic",
                    "Implement circuit breaker"
                ]
            })

        # Sort by confidence
        hypotheses.sort(key=lambda h: h["confidence"], reverse=True)

        return hypotheses
```

---

## 5. INTELLIGENT ALERTING SYSTEM

### 5.1 Dynamic Threshold Calculation

```python
class DynamicAlertThresholdEngine:
    """
    Calculates adaptive alert thresholds that reduce false positives
    while catching real issues.
    """

    def calculate_threshold(self, metric_name: str,
                           historical_days: int = 14,
                           percentile: float = 0.95,
                           safety_margin: float = 1.3) -> dict:
        """
        Calculate alert threshold using percentile + safety margin.

        Threshold = historical_percentile * safety_margin

        Example: If p95 API latency was 500ms, threshold = 500 * 1.3 = 650ms
        """

        # Get historical data
        historical_data = self.get_metric_history(
            metric_name,
            days_back=historical_days
        )

        if not historical_data:
            # Fallback to sensible default
            return self._get_default_threshold(metric_name)

        # Remove outliers using IQR method
        Q1 = np.percentile(historical_data, 25)
        Q3 = np.percentile(historical_data, 75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR

        filtered_data = [x for x in historical_data
                        if lower_bound <= x <= upper_bound]

        # Calculate percentile
        p_value = np.percentile(filtered_data, percentile * 100)

        # Apply safety margin
        threshold = p_value * safety_margin

        # Time-of-day adjustment
        # Different thresholds for business hours vs off-hours
        threshold_adjusted = self._adjust_for_time_of_day(
            threshold,
            metric_name
        )

        return {
            "metric": metric_name,
            "threshold_value": threshold_adjusted,
            "percentile_used": percentile,
            "safety_margin": safety_margin,
            "historical_p50": np.percentile(filtered_data, 50),
            "historical_p95": np.percentile(filtered_data, 95),
            "historical_p99": np.percentile(filtered_data, 99),
            "data_points": len(filtered_data),
            "confidence": len(filtered_data) / len(historical_data),
            "updated_at": datetime.now()
        }

    def _adjust_for_time_of_day(self, base_threshold: float,
                               metric_name: str) -> float:
        """
        Adjust thresholds based on time of day.

        Example: Business hours (9am-5pm) might have higher thresholds
        than overnight (lower traffic expected).
        """

        current_hour = datetime.now().hour

        # Business hours: 9-17 (UTC)
        if 9 <= current_hour < 17:
            return base_threshold * 1.1  # 10% higher tolerance
        # Night hours: 22-6 (lower traffic)
        elif current_hour >= 22 or current_hour < 6:
            return base_threshold * 0.9  # 10% lower tolerance
        # Dawn/dusk
        else:
            return base_threshold
```

### 5.2 Alert Correlation and Deduplication

```python
class AlertCorrelationEngine:
    """
    Groups related alerts to reduce alert fatigue.

    Instead of: 500 alerts about "connection pool exhausted"
    You get: 1 alert about "Connection pool exhaustion affecting 500 operations"
    """

    def correlate_alerts(self, recent_alerts: List[dict],
                        window_seconds: int = 60) -> List[dict]:
        """
        Group alerts by underlying cause.
        """

        correlated_groups = []
        processed = set()

        for i, alert1 in enumerate(recent_alerts):
            if i in processed:
                continue

            group = [alert1]
            processed.add(i)

            for j, alert2 in enumerate(recent_alerts[i+1:], start=i+1):
                if j in processed:
                    continue

                # Check if alerts should be grouped
                if self._should_correlate(alert1, alert2, window_seconds):
                    group.append(alert2)
                    processed.add(j)

            # Create correlated alert
            correlated = self._create_correlated_alert(group)
            correlated_groups.append(correlated)

        return correlated_groups

    def _should_correlate(self, alert1: dict, alert2: dict,
                         window_seconds: int) -> bool:
        """
        Determine if two alerts are related.

        Correlation factors:
        1. Time proximity (within window)
        2. Tag/attribute overlap (same service, user, etc.)
        3. Semantic similarity (both about performance, both about errors)
        4. Resource overlap (same database, server, etc.)
        """

        # Factor 1: Time
        time_diff = abs(alert2["timestamp"] - alert1["timestamp"])
        if time_diff > window_seconds:
            return False

        # Factor 2: Tags/attributes
        tags1 = set(alert1.get("tags", []))
        tags2 = set(alert2.get("tags", []))
        tag_overlap = len(tags1 & tags2) / max(len(tags1 | tags2), 1)

        # Factor 3: Semantic similarity
        semantic_similarity = self._semantic_similarity(
            alert1["message"],
            alert2["message"]
        )

        # Factor 4: Resource overlap
        resource_overlap = self._resource_overlap(
            alert1.get("affected_resources", []),
            alert2.get("affected_resources", [])
        )

        # Combined score
        correlation_score = (
            (time_diff / window_seconds) * 0.3 +  # Normalize to 0-1
            tag_overlap * 0.3 +
            semantic_similarity * 0.2 +
            resource_overlap * 0.2
        )

        return correlation_score > 0.5

    def _create_correlated_alert(self, group: List[dict]) -> dict:
        """
        Merge multiple alerts into single, richer alert.
        """

        return {
            "type": "correlated_alert",
            "count": len(group),
            "first_alert_timestamp": min([a["timestamp"] for a in group]),
            "last_alert_timestamp": max([a["timestamp"] for a in group]),
            "alert_types": list(set([a["alert_type"] for a in group])),
            "severity": max([a["severity"] for a in group]),
            "unique_affected_resources": list(set(
                resource for a in group
                for resource in a.get("affected_resources", [])
            )),
            "messages": [a["message"] for a in group],
            "summary": self._generate_summary(group),
            "recommended_action": self._suggest_action(group)
        }

    def _generate_summary(self, group: List[dict]) -> str:
        """Generate single-line summary of alert group."""

        # Use LLM to summarize
        messages = "\n".join([a["message"] for a in group])

        response = anthropic_client.messages.create(
            model="claude-opus-4-6",
            max_tokens=150,
            messages=[{
                "role": "user",
                "content": f"""Summarize these {len(group)} related alerts into one sentence:
{messages}

Focus on the underlying cause, not individual occurrences."""
            }]
        )

        return response.content[0].text
```

### 5.3 Predictive Alerting

```python
class PredictiveAlertEngine:
    """
    Warn before failures occur based on trending patterns.
    """

    def predict_future_threshold_breach(self,
                                       metric_name: str,
                                       current_value: float,
                                       alert_threshold: float,
                                       historical_trend_hours: int = 24) -> dict:
        """
        Predict if metric will exceed threshold in next N hours.

        Uses time-series forecasting (exponential smoothing, linear regression).
        """

        # Get historical values
        history = self.get_metric_history(
            metric_name,
            hours=historical_trend_hours
        )

        if len(history) < 5:
            return {"can_predict": False, "reason": "insufficient_data"}

        # Fit trend
        timestamps = np.arange(len(history))
        coefficients = np.polyfit(timestamps, history, 1)
        trend_slope = coefficients[0]  # Change per hour

        # Project forward
        projection_hours = 4
        projected_value = current_value + (trend_slope * projection_hours)

        if projected_value > alert_threshold:
            # Will exceed threshold
            hours_until_breach = (alert_threshold - current_value) / (trend_slope + 0.0001)
            hours_until_breach = max(0.1, min(projection_hours, hours_until_breach))

            return {
                "will_breach": True,
                "predicted_breach_time": datetime.now() + timedelta(hours=hours_until_breach),
                "projected_value": projected_value,
                "threshold": alert_threshold,
                "hours_until_breach": hours_until_breach,
                "trend_per_hour": trend_slope,
                "recommendation": f"Alert 30 min before predicted breach at {projected_value:.2f}",
                "confidence": self._calculate_trend_confidence(history)
            }
        else:
            return {
                "will_breach": False,
                "projected_value": projected_value,
                "threshold": alert_threshold,
                "trend_per_hour": trend_slope,
                "confidence": self._calculate_trend_confidence(history)
            }

    def generate_preventive_alert(self, breach_prediction: dict) -> dict:
        """
        Create a proactive alert before actual threshold breach.
        """

        if not breach_prediction["will_breach"]:
            return None

        # Calculate urgency
        hours_remaining = breach_prediction["hours_until_breach"]
        if hours_remaining < 1:
            urgency = "critical"
        elif hours_remaining < 4:
            urgency = "high"
        else:
            urgency = "medium"

        return {
            "type": "predictive_alert",
            "urgency": urgency,
            "metric": breach_prediction.get("metric_name"),
            "message": f"Alert: {breach_prediction.get('metric_name')} will exceed threshold "
                      f"in ~{breach_prediction['hours_until_breach']:.1f} hours. "
                      f"Projected value: {breach_prediction['projected_value']:.2f}",
            "suggested_actions": [
                "Review current trend and identify driver",
                "Scale resources proactively",
                "Optimize slow operations",
                "Enable rate limiting if appropriate"
            ],
            "confidence": breach_prediction["confidence"]
        }
```

---

## 6. REPORT GENERATION

### 6.1 Automated Report Types

**Report 1: Executive Summary (5-10 minutes to read)**

```python
def generate_executive_summary(time_period: str = "24h") -> str:
    """
    High-level overview for non-technical stakeholders.

    Includes:
    - System health score (0-100)
    - Key incidents (user-facing impact)
    - Performance trend (improving/degrading/stable)
    - Recommendations for leadership
    """

    # Gather metrics
    health_score = calculate_health_score(time_period)
    incidents = get_user_facing_incidents(time_period)
    trend = calculate_performance_trend(time_period)

    # Use LLM to generate narrative
    response = anthropic_client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Generate an executive summary for AR System performance for {time_period}.

System Health Score: {health_score}/100
Key Incidents: {json.dumps(incidents, indent=2)}
Performance Trend: {trend}

Write a professional summary suitable for a CIO or VP of Engineering:
- Lead with overall health
- Mention user impact (quantified if possible)
- Highlight positive trends or concerning trends
- End with 2-3 business recommendations

Keep it to 300 words maximum."""
        }]
    )

    return response.content[0].text
```

**Report 2: Incident Report (30-60 minutes investigation time**)