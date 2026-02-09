# ARLogAnalyzer: AI-Powered BMC Remedy Log Analysis Platform
## PART 2: Report Generation, Claude Integration, and RAG

---

## 6. REPORT GENERATION (Continued)

### 6.1 Automated Report Types (Continued)

**Report 2: Incident Report**

```python
def generate_incident_report(incident_id: str,
                            include_recommendations: bool = True) -> dict:
    """
    Detailed technical report documenting incident from discovery to resolution.

    Sections:
    1. Timeline of events
    2. Affected systems/users
    3. Root cause analysis
    4. Resolution steps taken
    5. Preventive measures
    """

    incident = get_incident(incident_id)
    logs_data = get_logs_for_incident(incident)

    # Run full RCA
    rca_results = run_full_rca(logs_data, incident)

    # Generate timeline
    timeline = build_event_timeline(logs_data)

    # Generate impact analysis
    impact = analyze_incident_impact(logs_data, incident)

    # Use Claude to synthesize
    report_content = anthropic_client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": f"""Generate a detailed incident report based on this data:

INCIDENT OVERVIEW:
{json.dumps(incident, indent=2)}

EVENT TIMELINE:
{json.dumps(timeline, indent=2)}

ROOT CAUSE ANALYSIS:
{json.dumps(rca_results, indent=2)}

USER IMPACT:
{json.dumps(impact, indent=2)}

Create a comprehensive technical report with:
1. Executive Summary (100 words)
2. Timeline (with key events)
3. Root Cause (clear explanation for technical audience)
4. Impact Assessment (affected users, transactions, duration)
5. Resolution Actions Taken
6. Post-Incident Actions (preventive measures)

Format as structured markdown."""
        }]
    )

    return {
        "incident_id": incident_id,
        "report_content": report_content.content[0].text,
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "time_period": f"{incident['start_time']} to {incident['end_time']}",
            "rca_confidence": rca_results["top_hypothesis"]["confidence"],
            "impact_score": impact["severity"]
        }
    }
```

**Report 3: Performance Trend Report (Weekly/Monthly)**

```python
def generate_performance_trend_report(period: str = "week",
                                     compare_to_prior: bool = True) -> str:
    """
    Trend analysis showing performance progression over time.

    Includes:
    - Key metrics and their trends
    - Comparison to prior period
    - Anomalies detected
    - Forecasts for next period
    """

    metrics = get_performance_metrics(period)
    prior_metrics = get_performance_metrics(period, offset=1)

    # Calculate trends
    trend_analysis = {
        "api_latency": {
            "current_p95": metrics["api_p95"],
            "prior_p95": prior_metrics["api_p95"],
            "change_pct": ((metrics["api_p95"] - prior_metrics["api_p95"]) / prior_metrics["api_p95"] * 100),
            "trend": "improving" if metrics["api_p95"] < prior_metrics["api_p95"] else "degrading"
        },
        "error_rate": {
            "current": metrics["error_rate"],
            "prior": prior_metrics["error_rate"],
            "change_pct": ((metrics["error_rate"] - prior_metrics["error_rate"]) / (prior_metrics["error_rate"] + 0.001) * 100)
        },
        "throughput": {
            "current": metrics["requests_per_sec"],
            "prior": prior_metrics["requests_per_sec"],
            "change_pct": ((metrics["requests_per_sec"] - prior_metrics["requests_per_sec"]) / prior_metrics["requests_per_sec"] * 100)
        }
    }

    # Get anomalies
    anomalies = detect_anomalies_in_period(period)

    # Forecast next period
    forecast = forecast_metrics(period)

    # Generate narrative
    response = anthropic_client.messages.create(
        model="claude-opus-4-6",
        max_tokens=3000,
        messages=[{
            "role": "user",
            "content": f"""Write a performance trend report for {period}:

METRICS COMPARISON:
{json.dumps(trend_analysis, indent=2)}

ANOMALIES DETECTED:
{json.dumps(anomalies, indent=2)}

FORECAST FOR NEXT PERIOD:
{json.dumps(forecast, indent=2)}

Structure the report as:
1. Summary (1-2 sentences on overall trend)
2. Detailed Metrics (explain each change)
3. Notable Events (anomalies, deployments)
4. Forecast (expectations for next period)
5. Recommendations (if trend is negative)

Use clear language for technical audience."""
        }]
    )

    return response.content[0].text
```

**Report 4: Comparison Report (This Week vs Last Week, etc.)**

```python
def generate_comparison_report(period1: str, period2: str) -> dict:
    """
    Compare two time periods to highlight what changed.

    Useful for: "How did we do after optimization?" or "Impact of deployment?"
    """

    metrics1 = get_performance_metrics(period1)
    metrics2 = get_performance_metrics(period2)

    # Detailed comparison
    comparison = {
        "api_latency_p95": {
            "period1": metrics1["api_p95"],
            "period2": metrics2["api_p95"],
            "improvement": metrics1["api_p95"] - metrics2["api_p95"],
            "improvement_pct": ((metrics1["api_p95"] - metrics2["api_p95"]) / metrics1["api_p95"] * 100)
        },
        "error_rate": {
            "period1": metrics1["error_rate"],
            "period2": metrics2["error_rate"],
            "improvement": metrics1["error_rate"] - metrics2["error_rate"],
            "improvement_pct": ((metrics1["error_rate"] - metrics2["error_rate"]) / (metrics1["error_rate"] + 0.001) * 100)
        },
        "throughput": {
            "period1": metrics1["requests_per_sec"],
            "period2": metrics2["requests_per_sec"],
            "change": metrics2["requests_per_sec"] - metrics1["requests_per_sec"],
            "change_pct": ((metrics2["requests_per_sec"] - metrics1["requests_per_sec"]) / metrics1["requests_per_sec"] * 100)
        }
    }

    # Use LLM to interpret
    response = anthropic_client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Compare these two time periods and highlight the differences:

{period1}:
{json.dumps(metrics1, indent=2)}

{period2}:
{json.dumps(metrics2, indent=2)}

COMPARISON METRICS:
{json.dumps(comparison, indent=2)}

Generate a comparison report that:
1. Identifies which metrics improved, degraded, or stayed same
2. Quantifies improvements as percentages and absolute values
3. Explains what likely caused major changes
4. Rates overall progress (better/worse/mixed)

Use clear, concise language."""
        }]
    )

    return {
        "period1": period1,
        "period2": period2,
        "comparison_metrics": comparison,
        "analysis": response.content[0].text
    }
```

### 6.2 Report Templates and Formatting

**Template Structure:**

```python
REPORT_TEMPLATES = {
    "executive_summary": {
        "title": "AR System Health Summary - {period}",
        "sections": [
            "health_score",
            "key_incidents",
            "trends",
            "recommendations"
        ],
        "audience": "executives",
        "length": "5-10 min read"
    },
    "incident_report": {
        "title": "Incident Report #{incident_id}",
        "sections": [
            "executive_summary",
            "timeline",
            "root_cause",
            "impact",
            "remediation",
            "prevention"
        ],
        "audience": "technical",
        "length": "30-60 min read"
    },
    "trend_report": {
        "title": "Performance Trend Report - {period}",
        "sections": [
            "summary",
            "detailed_metrics",
            "notable_events",
            "forecast",
            "recommendations"
        ],
        "audience": "technical",
        "length": "15-20 min read"
    }
}
```

### 6.3 Multi-Format Output

Reports are generated in multiple formats for different consumption methods:

```python
def export_report(report_content: str, format: str) -> bytes:
    """
    Export report in various formats.
    """

    if format == "markdown":
        return report_content.encode('utf-8')

    elif format == "html":
        # Convert markdown to HTML
        html = markdown_to_html(report_content)
        return html.encode('utf-8')

    elif format == "pdf":
        # Generate styled PDF
        pdf = generate_pdf_from_markdown(report_content, style="professional")
        return pdf

    elif format == "json":
        # Structured JSON for programmatic consumption
        return json.dumps({
            "content": report_content,
            "generated_at": datetime.now().isoformat(),
            "format": "markdown"
        }).encode('utf-8')

    elif format == "slack":
        # Slack-formatted message with thread support
        return format_for_slack(report_content)

    elif format == "email":
        # HTML email with good client compatibility
        return generate_email_html(report_content)
```

---

## 7. CLAUDE API INTEGRATION ARCHITECTURE

### 7.1 Token Management and Cost Optimization

**Token Budget System:**

```python
class TokenBudgetManager:
    """
    Manages token usage across all Claude API calls to optimize costs.
    """

    def __init__(self, daily_budget_tokens: int = 1_000_000):
        self.daily_budget = daily_budget_tokens
        self.used_today = 0
        self.usage_by_task = {}  # Track usage per skill/task

    def should_use_claude_for_task(self,
                                   task_id: str,
                                   estimated_tokens: int,
                                   priority: str = "normal") -> dict:
        """
        Decide whether to use Claude API or local ML for this task.

        Decision factors:
        1. Token budget remaining
        2. Task priority
        3. Local ML capability available
        4. Accuracy trade-off
        """

        budget_remaining = self.daily_budget - self.used_today
        budget_utilization = self.used_today / self.daily_budget

        decision = {
            "use_claude": True,
            "reason": "",
            "alternative": None,
            "confidence": 1.0
        }

        # High budget utilization - be selective
        if budget_utilization > 0.8:
            if priority == "low" and estimated_tokens > 10000:
                decision["use_claude"] = False
                decision["reason"] = "Budget conservation for high-token task"
                decision["alternative"] = "local_ml"
            elif estimated_tokens > budget_remaining * 0.1:
                decision["use_claude"] = False
                decision["reason"] = "Token allocation limit"
                decision["alternative"] = "local_pattern_matching"

        # Specific task optimizations
        if task_id == "anomaly_detection" and estimated_tokens > 5000:
            # Use statistical local ML for anomaly detection
            decision["use_claude"] = False
            decision["reason"] = "Statistical anomaly detection is cost-effective"
            decision["alternative"] = "statistical_analysis"
            decision["confidence"] = 0.95  # Very confident

        elif task_id == "nlp_parsing" and estimated_tokens < 2000:
            # Always use Claude for NL parsing (better accuracy)
            decision["use_claude"] = True

        return decision

    def estimate_tokens(self, text: str, model: str = "claude-opus-4-6") -> int:
        """
        Estimate tokens for given text.

        Rough rule: ~4 characters = 1 token
        """
        return len(text) // 4

    def log_usage(self, task_id: str, tokens_used: int,
                 cost: float, model: str) -> None:
        """Log API usage for analysis."""

        self.used_today += tokens_used

        if task_id not in self.usage_by_task:
            self.usage_by_task[task_id] = {
                "count": 0,
                "total_tokens": 0,
                "total_cost": 0
            }

        self.usage_by_task[task_id]["count"] += 1
        self.usage_by_task[task_id]["total_tokens"] += tokens_used
        self.usage_by_task[task_id]["total_cost"] += cost
```

**Cost Optimization Strategies:**

```python
class CostOptimizationEngine:
    """
    Implements multiple strategies to reduce Claude API costs.
    """

    def strategy_1_prompt_caching(self, large_log_context: str,
                                  query: str) -> dict:
        """
        Use Claude's Prompt Caching to avoid re-processing same logs.

        First call: Process large log context (expensive)
        Subsequent calls: Cache hit, only pay for new query (cheap)

        Potential savings: 90% for repeated analysis of same logs
        """

        cache_key = hashlib.sha256(large_log_context.encode()).hexdigest()

        # Check if context is cached
        cached_response = self.check_cache(cache_key)
        if cached_response:
            # Just process new query against cached analysis
            return self._query_cached_context(cached_response, query)

        # First time - analyze full context
        response = anthropic_client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4000,
            system=[
                {
                    "type": "text",
                    "text": "You are a log analysis expert."
                },
                {
                    "type": "text",
                    "text": f"Analyze this log context:\n{large_log_context}",
                    "cache_control": {"type": "ephemeral"}  # Enable caching
                }
            ],
            messages=[{
                "role": "user",
                "content": query
            }]
        )

        # Store in cache
        self.store_cache(cache_key, response)

        return {
            "response": response.content[0].text,
            "cache_created": True,
            "usage": response.usage
        }

    def strategy_2_batching(self, queries: List[str],
                           shared_context: str) -> List[dict]:
        """
        Batch multiple queries to same log context in one request.

        Instead of: 10 separate API calls
        Do: 1 batch request with 10 queries
        """

        batch_request = f"""
Analyze this log context:
{shared_context}

Now answer these {len(queries)} questions:

"""
        for i, query in enumerate(queries, 1):
            batch_request += f"{i}. {query}\n"

        batch_request += "\n\nProvide separate answers for each question."

        response = anthropic_client.messages.create(
            model="claude-opus-4-6",
            max_tokens=5000,
            messages=[{
                "role": "user",
                "content": batch_request
            }]
        )

        # Parse responses
        answers = response.content[0].text.split("\n\n")

        return [
            {
                "query": q,
                "answer": answers[i] if i < len(answers) else ""
            }
            for i, q in enumerate(queries)
        ]

    def strategy_3_use_cheaper_models(self, task_complexity: str) -> str:
        """
        Route simple tasks to cheaper Claude models.

        Model costs (approximate):
        - Claude Haiku: $0.80/$24 per MTok (cheapest, fastest)
        - Claude Sonnet 3.5: $3/$15 per MTok (balanced)
        - Claude Opus 4.6: $15/$45 per MTok (most capable)
        """

        if task_complexity == "simple":
            return "claude-haiku-4-5"  # 10x cheaper
        elif task_complexity == "medium":
            return "claude-3-5-sonnet"  # Balanced
        else:
            return "claude-opus-4-6"  # Best quality

    def strategy_4_local_processing_first(self,
                                         log_analysis_task: str) -> dict:
        """
        Use local ML/regex for initial filtering before Claude.

        Example: Find all ERROR lines locally, then send only
        those to Claude for analysis (90% token reduction).
        """

        # Local regex/pattern matching
        filtered_logs = self._filter_logs_locally(log_analysis_task)

        if len(filtered_logs) > 10000:
            # Still too much for Claude - further filter
            prioritized = self._prioritize_logs(filtered_logs)[:5000]
        else:
            prioritized = filtered_logs

        # Only send filtered logs to Claude
        return {
            "original_size": len(log_analysis_task),
            "filtered_size": len(prioritized),
            "reduction_pct": (1 - len(prioritized) / len(log_analysis_task)) * 100,
            "filtered_logs": prioritized
        }
```

### 7.2 Chunking Strategy for Large Logs

**Multi-Level Chunking Approach:**

```python
class LogChunkingEngine:
    """
    Breaks large log files into Claude-friendly chunks with overlapping context.
    """

    def chunk_logs_semantic(self, logs: List[str],
                           max_tokens: int = 8000) -> List[dict]:
        """
        Semantic chunking: Group logs by transaction/operation.

        Benefits:
        - Maintains log coherence
        - Preserves transaction context
        - Better for RCA analysis
        """

        chunks = []
        current_chunk = []
        current_tokens = 0

        for log_line in logs:
            line_tokens = len(log_line) // 4  # Estimate

            # Check if adding this line exceeds token limit
            if current_tokens + line_tokens > max_tokens and current_chunk:
                # Save current chunk
                chunks.append({
                    "logs": current_chunk,
                    "token_count": current_tokens,
                    "start_time": current_chunk[0].split("|")[0] if "|" in current_chunk[0] else None,
                    "end_time": current_chunk[-1].split("|")[0] if "|" in current_chunk[-1] else None
                })

                # Start new chunk
                current_chunk = [log_line]
                current_tokens = line_tokens
            else:
                current_chunk.append(log_line)
                current_tokens += line_tokens

        # Add final chunk
        if current_chunk:
            chunks.append({
                "logs": current_chunk,
                "token_count": current_tokens,
                "start_time": current_chunk[0].split("|")[0] if "|" in current_chunk[0] else None,
                "end_time": current_chunk[-1].split("|")[0] if "|" in current_chunk[-1] else None
            })

        return chunks

    def chunk_logs_with_overlap(self, chunks: List[dict],
                               overlap_lines: int = 10) -> List[dict]:
        """
        Add overlapping context between chunks.

        Overlap allows Claude to understand relationships across chunk boundaries.
        """

        enhanced_chunks = []

        for i, chunk in enumerate(chunks):
            context_before = []
            context_after = []

            # Add tail of previous chunk as context
            if i > 0:
                context_before = chunks[i-1]["logs"][-overlap_lines:]

            # Add head of next chunk as context
            if i < len(chunks) - 1:
                context_after = chunks[i+1]["logs"][:overlap_lines]

            enhanced_chunk = {
                "context_before": context_before,
                "main_logs": chunk["logs"],
                "context_after": context_after,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "token_count": chunk["token_count"] + (len(context_before) + len(context_after)) * 5
            }

            enhanced_chunks.append(enhanced_chunk)

        return enhanced_chunks

    def chunk_logs_by_time(self, logs: List[str],
                          time_window_minutes: int = 5) -> List[dict]:
        """
        Time-based chunking: Group logs by time window.

        Useful for: "Analyze logs from 3:00-3:05 PM"
        """

        chunks = []
        current_chunk = []
        current_window_start = None

        for log_line in logs:
            # Extract timestamp (format: "2024-02-09 14:30:45" typical)
            try:
                timestamp_str = log_line.split("|")[0].strip() if "|" in log_line else log_line[:19]
                timestamp = datetime.fromisoformat(timestamp_str)
            except:
                # Fallback if parsing fails
                if current_chunk:
                    timestamp = current_window_start + timedelta(minutes=time_window_minutes)
                else:
                    continue

            # Initialize window
            if current_window_start is None:
                current_window_start = timestamp

            # Check if we're still in the same time window
            time_delta = (timestamp - current_window_start).total_seconds() / 60
            if time_delta > time_window_minutes and current_chunk:
                # Save chunk and start new one
                chunks.append({
                    "logs": current_chunk,
                    "time_window_start": current_window_start,
                    "time_window_end": timestamp,
                    "log_count": len(current_chunk)
                })

                current_chunk = [log_line]
                current_window_start = timestamp
            else:
                current_chunk.append(log_line)

        # Save final chunk
        if current_chunk:
            chunks.append({
                "logs": current_chunk,
                "time_window_start": current_window_start,
                "time_window_end": current_window_start + timedelta(minutes=time_window_minutes),
                "log_count": len(current_chunk)
            })

        return chunks
```

### 7.3 Streaming Responses for Real-Time Analysis

```python
class StreamingAnalysisEngine:
    """
    Stream Claude responses for real-time feedback instead of waiting for complete response.
    """

    def stream_log_analysis(self, logs: str, query: str) -> Generator[str, None, None]:
        """
        Stream analysis results as they're generated.

        Benefits:
        - User sees results appearing in real-time
        - Can stop early if not useful
        - Better UX for long analyses
        """

        with anthropic_client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=4000,
            messages=[{
                "role": "user",
                "content": f"Analyze these logs:\n{logs}\n\nQuestion: {query}"
            }]
        ) as stream:
            for text in stream.text_stream:
                yield text

    def stream_to_client(self, analysis_stream: Generator) -> None:
        """
        Send streaming response to client (e.g., via WebSocket or SSE).

        For web UI: Server-Sent Events
        For CLI: Print as it arrives
        For API: Return streaming response
        """

        for chunk in analysis_stream:
            # Send to client
            print(chunk, end="", flush=True)  # For CLI
            # OR
            # websocket.send(chunk)  # For WebSocket
            # OR
            # yield chunk  # For Flask/FastAPI streaming

    def stream_with_function_calls(self, logs: str,
                                   query: str) -> dict:
        """
        Stream structured analysis with function calls.

        Streams can include:
        1. Initial findings
        2. Function calls for deeper analysis
        3. Function results
        4. Final summary
        """

        with anthropic_client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=4000,
            tools=[
                {
                    "name": "query_logs",
                    "description": "Execute structured log query",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "log_type": {"type": "string"},
                            "filters": {"type": "object"},
                            "aggregation": {"type": "string"}
                        }
                    }
                },
                {
                    "name": "correlate_events",
                    "description": "Find correlated events",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "event_type": {"type": "string"},
                            "time_window": {"type": "integer"}
                        }
                    }
                }
            ],
            messages=[{
                "role": "user",
                "content": query
            }]
        ) as stream:
            # Process streamed events
            for event in stream:
                if hasattr(event, 'type'):
                    if event.type == "content_block_start":
                        # New content starting
                        print(f"[Analysis starting]", flush=True)
                    elif event.type == "content_block_delta":
                        # Chunk of response
                        print(event.delta.text, end="", flush=True)
                    elif event.type == "content_block_stop":
                        # Content complete
                        print(f"\n[Analysis complete]", flush=True)
```

### 7.4 Prompt Engineering for Log Analysis

**Core Prompts:**

```python
SYSTEM_PROMPT = """You are an expert BMC Remedy AR System administrator and log analyst.

You understand:
- AR System architecture and components
- API, SQL, Filter, and Escalation execution
- Performance tuning and optimization
- Root cause analysis methodology
- Database query optimization

When analyzing logs:
1. Be precise with metrics (always include units like "ms", "%")
2. Cite specific log entries to support conclusions
3. Quantify impact when possible (e.g., "2,400 transactions affected")
4. Suggest actionable remediation steps
5. Consider the broader system context

Your goal is to help AR System administrators quickly understand and fix issues."""

def get_analysis_prompt(task_type: str, context: dict) -> str:
    """
    Generate task-specific prompt templates.
    """

    prompts = {
        "performance_analysis": f"""
Analyze these API logs for performance issues:

{context['logs']}

Provide:
1. Baseline metrics (p50, p95, p99 latency)
2. Metrics that exceed baseline
3. Potential causes (filter inefficiency, SQL slowness, resource contention)
4. Specific remediation steps
5. Estimated improvement if fixed

Be specific with numbers and percentages.""",

        "error_investigation": f"""
Analyze these error logs:

{context['logs']}

Determine:
1. Error type and frequency
2. Which component is failing (API, Filter, SQL, Escalation)
3. Root cause (configuration, code bug, resource exhaustion, data issue)
4. Affected transactions (count and percentage)
5. Quick fix vs. permanent fix
6. Prevention strategy

Cite specific error messages as evidence.""",

        "rca": f"""
Perform root cause analysis on this incident:

Symptom: {context['symptom']}
Time: {context['time_window']}

Related logs:
{context['logs']}

Build a dependency graph showing:
1. Primary cause (most likely)
2. Contributing factors
3. Evidence for each hypothesis
4. Confidence level for primary cause
5. Steps to verify the root cause

Format as a narrative explaining the cause chain."""
    }

    return prompts.get(task_type, prompts["performance_analysis"])
```

---

## 8. RAG (RETRIEVAL AUGMENTED GENERATION) FOR LOGS

### 8.1 RAG Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Log Data Ingestion                          │
│  (arapi.log, arsql.log, arfilter.log, aresc.log)           │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              Document Chunking & Parsing                     │
│  (Extract structured fields: timestamp, operation, time)    │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│           Vector Embedding Generation                        │
│  (Convert log chunks to embeddings using VoyageAI)         │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│          Vector Database Storage                             │
│  (Pinecone, Weaviate, or pgvector)                         │
│  Store: embedding, log text, metadata, timestamp           │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  User Query / Natural Language Question                      │
│  "Why are API calls slow?"                                   │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Query Embedding & Retrieval                                 │
│  1. Embed user query                                         │
│  2. Find K nearest log chunks (semantic similarity)         │
│  3. Re-rank results (optional, using Claude)                │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Context Assembly                                            │
│  Combine: user query + retrieved logs → LLM input           │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Claude API Processing                                       │
│  Generate answer grounded in retrieved logs                 │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Response Generation                                         │
│  Output: Answer + cited log excerpts + confidence           │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Vector Embedding Strategy

**Multi-Embedding Approach:**

```python
class LogEmbeddingEngine:
    """
    Create meaningful embeddings for log entries.
    """

    def __init__(self, embedding_model: str = "voyage-2"):
        self.client = voyageai.Client(api_key=os.environ.get("VOYAGE_API_KEY"))
        self.embedding_model = embedding_model

    def prepare_log_for_embedding(self, log_entry: dict) -> str:
        """
        Convert log entry to text suitable for embedding.

        Strategy: Include context that helps semantic search
        - What happened (operation)
        - How long it took (duration)
        - What the status was (success/error)
        - Relevant fields (user, record type, etc.)
        """

        if log_entry.get("log_type") == "arapi":
            text = f"""
API Call: {log_entry.get('operation', 'unknown')}
Duration: {log_entry.get('duration_ms', 'unknown')}ms
Status: {log_entry.get('status', 'unknown')}
User: {log_entry.get('user', 'unknown')}
Error: {log_entry.get('error_message', '')}
Timestamp: {log_entry.get('timestamp', '')}
"""

        elif log_entry.get("log_type") == "arsql":
            text = f"""
SQL Query: {log_entry.get('query_snippet', 'unknown')}
Table: {log_entry.get('table_name', 'unknown')}
Duration: {log_entry.get('duration_ms', 'unknown')}ms
Rows Affected: {log_entry.get('rows_affected', 'unknown')}
Status: {log_entry.get('status', 'unknown')}
Timestamp: {log_entry.get('timestamp', '')}
"""

        elif log_entry.get("log_type") == "arfilter":
            text = f"""
Filter: {log_entry.get('filter_name', 'unknown')}
Action: {log_entry.get('action', 'unknown')}
Duration: {log_entry.get('duration_ms', 'unknown')}ms
Status: {log_entry.get('status', 'unknown')}
Triggered By: {log_entry.get('trigger', 'unknown')}
Timestamp: {log_entry.get('timestamp', '')}
"""

        elif log_entry.get("log_type") == "aresc":
            text = f"""
Escalation: {log_entry.get('escalation_name', 'unknown')}
Trigger: {log_entry.get('trigger_reason', 'unknown')}
Duration to Execute: {log_entry.get('duration_ms', 'unknown')}ms
Status: {log_entry.get('status', 'unknown')}
Timestamp: {log_entry.get('timestamp', '')}
"""

        return text

    def embed_logs(self, logs: List[dict], batch_size: int = 128) -> List[dict]:
        """
        Embed logs in batches for efficiency.

        Cost: ~$0.02 per million tokens
        """

        embeddings = []

        for i in range(0, len(logs), batch_size):
            batch = logs[i:i+batch_size]
            texts = [self.prepare_log_for_embedding(log) for log in batch]

            # Call Voyage AI API
            response = self.client.embed(
                texts,
                model=self.embedding_model
            )

            for j, log in enumerate(batch):
                embeddings.append({
                    "log_id": log.get("id"),
                    "log_type": log.get("log_type"),
                    "timestamp": log.get("timestamp"),
                    "embedding": response.embeddings[j],
                    "text": texts[j],
                    "original_log": log
                })

        return embeddings

    def embed_user_query(self, query: str) -> List[float]:
        """Embed user query using same model."""

        response = self.client.embed([query], model=self.embedding_model)
        return response.embeddings[0]
```

### 8.3 Vector Database Integration

**Pinecone Example:**

```python
class VectorDatabaseManager:
    """
    Manages embedding storage and retrieval.
    """

    def __init__(self, index_name: str = "remedy-logs"):
        from pinecone import Pinecone

        self.pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
        self.index = self.pc.Index(index_name)
        self.index_name = index_name

    def upsert_embeddings(self, embeddings: List[dict]) -> None:
        """
        Store embeddings in vector database.
        """

        vectors_to_upsert = []

        for emb in embeddings:
            vectors_to_upsert.append((
                emb["log_id"],  # ID
                emb["embedding"],  # Vector
                {
                    "log_type": emb["log_type"],
                    "timestamp": emb["timestamp"],
                    "text": emb["text"],
                    # Store key metadata for filtering
                    "operation": emb["original_log"].get("operation"),
                    "status": emb["original_log"].get("status"),
                    "duration_ms": emb["original_log"].get("duration_ms")
                }
            ))

        # Batch upsert
        self.index.upsert(vectors=vectors_to_upsert, batch_size=100)

    def retrieve_relevant_logs(self,
                              query_embedding: List[float],
                              k: int = 10,
                              filters: dict = None) -> List[dict]:
        """
        Find most similar logs using vector similarity.

        Optional metadata filtering:
        - log_type: only arapi, arsql, arfilter, or aresc
        - status: only errors, only successes, etc.
        - time_range: logs from specific time window
        """

        # Build filter
        where_filter = None
        if filters:
            if "log_type" in filters:
                where_filter = {"log_type": {"$eq": filters["log_type"]}}

        # Query vector database
        results = self.index.query(
            vector=query_embedding,
            top_k=k,
            include_metadata=True,
            filter=where_filter
        )

        # Return formatted results
        retrieved = []
        for match in results.matches:
            retrieved.append({
                "log_id": match.id,
                "similarity_score": match.score,
                "metadata": match.metadata,
                "log_text": match.metadata.get("text")
            })

        return retrieved
```

### 8.4 Semantic Search with Re-ranking

**Two-Stage Retrieval:**

```python
class SemanticSearchEngine:
    """
    Improve retrieval quality with re-ranking.

    Stage 1: Fast semantic search (100 candidates)
    Stage 2: LLM re-ranking (top 10)
    """

    def __init__(self, vector_db: VectorDatabaseManager):
        self.vector_db = vector_db
        self.anthropic_client = Anthropic()

    def search_with_reranking(self,
                             query: str,
                             k_retrieve: int = 100,
                             k_final: int = 10) -> List[dict]:
        """
        Two-stage retrieval: fast search + LLM reranking.
        """

        # Stage 1: Fast vector search
        query_embedding = embed_query(query)
        candidates = self.vector_db.retrieve_relevant_logs(
            query_embedding,
            k=k_retrieve
        )

        # Stage 2: LLM re-ranking
        reranked = self._rerank_with_claude(query, candidates, k_final)

        return reranked

    def _rerank_with_claude(self,
                           query: str,
                           candidates: List[dict],
                           k: int) -> List[dict]:
        """
        Use Claude to re-rank candidates by relevance.
        """

        # Prepare candidate list for Claude
        candidate_text = "\n\n".join([
            f"[{i+1}] Log ID: {c['log_id']}\n"
            f"Similarity: {c['similarity_score']:.3f}\n"
            f"Content: {c['log_text'][:200]}..."
            for i, c in enumerate(candidates[:20])  # Top 20 for reranking
        ])

        response = self.anthropic_client.messages.create(
            model="claude-opus-4-6",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": f"""
Given this query: "{query}"

Rank these log entries by relevance (most to least relevant).
Return only the log IDs in ranked order.

{candidate_text}

Return as: [1] [5] [3] [7] ...
(just the numbers, separated by spaces)
"""
            }]
        )

        # Parse ranking
        ranking_str = response.content[0].text.strip()
        ranked_indices = [int(x.strip('[]')) - 1 for x in ranking_str.split()
                         if x.strip('[]').isdigit()]

        # Reorder candidates
        reranked = [candidates[i] for i in ranked_indices if i < len(candidates)]

        return reranked[:k]

    def contextual_retrieval(self, query: str) -> List[dict]:
        """
        Anthropic's "Contextual Retrieval" technique.

        Add context to each chunk before embedding:
        "This is a log from API call processing..."

        Can improve retrieval accuracy by 49% (67% with reranking).
        """

        # For each log chunk, generate a brief context description
        logs = get_recent_logs()

        enriched_logs = []
        for log in logs:
            # Generate context for this log
            context = generate_log_context(log)

            enriched_text = f"{context}\n\nLog: {log['text']}"

            enriched_logs.append({
                "original_log": log,
                "enriched_text": enriched_text,
                "context": context
            })

        # Embed enriched texts
        embeddings = embed_logs(enriched_logs)

        # Store in vector DB
        self.vector_db.upsert_embeddings(embeddings)

        return enriched_logs

def generate_log_context(log: dict) -> str:
    """
    Generate context description for a log entry.

    Example: "This is an API log showing a ticket modification request
    that took 2.5 seconds, indicating potential performance issues."
    """

    if log.get("log_type") == "arapi":
        if log.get("duration_ms", 0) > 1000:
            return f"Slow API call to {log.get('operation')} (took {log.get('duration_ms')}ms)"
        elif log.get("status") == "ERROR":
            return f"Failed API call to {log.get('operation')} with error: {log.get('error_message')}"
        else:
            return f"Successful API call to {log.get('operation')}"

    # Similar logic for other log types...
    return "Log entry"
```

### 8.5 RAG Quality Metrics and Evaluation

```python
class RAGEvaluationEngine:
    """
    Measure RAG system quality independently at retrieval and generation levels.
    """

    def evaluate_retrieval_quality(self,
                                   test_queries: List[str],
                                   ground_truth: List[List[int]]) -> dict:
        """
        Evaluate retrieval stage independently.

        Metrics:
        - Precision@K: % of retrieved logs that are relevant
        - Recall@K: % of relevant logs that are retrieved
        - MRR: Mean Reciprocal Rank (how well ranked are relevant items)
        - NDCG: Normalized Discounted Cumulative Gain
        """

        precisions = []
        recalls = []
        mrrs = []

        for query, relevant_ids in zip(test_queries, ground_truth):
            # Retrieve logs
            results = semantic_search(query)
            retrieved_ids = [r["log_id"] for r in results[:10]]

            # Calculate metrics
            tp = len(set(retrieved_ids) & set(relevant_ids))

            precision = tp / len(retrieved_ids)
            recall = tp / len(relevant_ids) if relevant_ids else 0

            # MRR: Rank of first relevant item
            mrr = 0
            for rank, log_id in enumerate(retrieved_ids, 1):
                if log_id in relevant_ids:
                    mrr = 1 / rank
                    break

            precisions.append(precision)
            recalls.append(recall)
            mrrs.append(mrr)

        return {
            "avg_precision": np.mean(precisions),
            "avg_recall": np.mean(recalls),
            "avg_mrr": np.mean(mrrs),
            "f1_score": 2 * (np.mean(precisions) * np.mean(recalls)) /
                       (np.mean(precisions) + np.mean(recalls) + 0.001)
        }

    def evaluate_generation_quality(self,
                                    test_cases: List[dict]) -> dict:
        """
        Evaluate answer generation quality.

        Metrics:
        - Accuracy: Is the answer correct?
        - Cite coverage: Are answers backed by retrieved logs?
        - Hallucination rate: Does answer contain false information?
        """

        accuracies = []
        cite_rates = []

        for test in test_cases:
            query = test["query"]
            expected_answer = test["expected_answer"]
            ground_truth_logs = test["ground_truth_logs"]

            # Generate answer using RAG
            retrieved = retrieve_logs(query)
            answer = generate_answer(query, retrieved)

            # Use Claude as judge
            evaluation = self.anthropic_client.messages.create(
                model="claude-opus-4-6",
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": f"""
Evaluate this answer to the query: "{query}"

Expected answer: {expected_answer}

Generated answer: {answer}

Retrieved logs used for context:
{json.dumps(ground_truth_logs, indent=2)}

Rate:
1. Accuracy (0-100): Does the answer match expected?
2. Evidence quality (0-100): Is answer grounded in logs?
3. Hallucination (0-100): No false information?

Respond with: ACCURACY:X EVIDENCE:Y HALLUCINATION:Z
"""
                }]
            )

            # Parse evaluation
            eval_str = evaluation.content[0].text
            # Extract numbers...

        return {
            "avg_accuracy": np.mean(accuracies),
            "avg_cite_rate": np.mean(cite_rates)
        }
```

---

## Summary

This comprehensive design document covers:

1. **20 AI Skills** - Specialized capabilities for analyzing API, SQL, Filter, and Escalation logs
2. **NL Query Interface** - Converting natural language to structured log analysis with context-aware follow-ups
3. **Anomaly Detection** - Statistical methods including Z-score, IQR, moving averages, seasonal pattern recognition
4. **RCA Engine** - Correlation across logs, dependency graph construction, hypothesis ranking
5. **Intelligent Alerting** - Dynamic thresholds, alert correlation, deduplication, predictive alerts
6. **Report Generation** - Executive summaries, incident reports, trend analysis, multi-format export
7. **Claude Integration** - Token budgeting, cost optimization strategies, chunking, streaming, prompt engineering
8. **RAG for Logs** - Vector embeddings, semantic search, re-ranking, quality metrics

## Implementation Roadmap

**Phase 1 (Weeks 1-4)**: Core Infrastructure
- Log parsing and chunking
- Vector embedding pipeline
- Vector database setup
- Basic similarity search

**Phase 2 (Weeks 5-8)**: Skills and Analysis
- Implement top 10 AI skills
- Anomaly detection engine
- RCA correlation engine
- Claude API integration

**Phase 3 (Weeks 9-12)**: User Interface
- Natural language query interface
- Report generation
- Dashboard/visualization
- Alert management

**Phase 4 (Weeks 13+)**: Advanced Features
- Predictive alerting
- Advanced RCA with LLM synthesis
- Custom skill framework
- Production hardening

---

## Technology Stack Recommendations

- **Vector Database**: Pinecone (serverless) or pgvector (self-hosted)
- **Embeddings**: VoyageAI or OpenAI
- **LLM**: Claude Opus 4.6 (primary), Claude Haiku (cost optimization)
- **Log Storage**: TimescaleDB or ClickHouse for high-volume log storage
- **Backend**: Python (FastAPI) or Node.js (Express)
- **Frontend**: React or Vue.js
- **Deployment**: Kubernetes or Docker Compose

---

## Cost Estimates

**Rough monthly costs** (for 1M logs/day):

- Claude API: $500-$2,000 (depending on analysis depth)
- Vector Embeddings: $10-$50
- Vector Database: $20-$100
- Log Storage: $200-$500
- Infrastructure: $500-$2,000

**Total: $1,230-$4,650/month**

Cost can be optimized to $300-$500/month using prompt caching, local anomaly detection, and batching strategies.
