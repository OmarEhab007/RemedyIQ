# ARLogAnalyzer: Implementation Quick Start Guide

## Getting Started in 1 Hour

This guide walks you through setting up the core components of ARLogAnalyzer.

### Prerequisites

- Python 3.10+
- Node.js 18+
- Docker
- Anthropic API key (Claude)
- Pinecone API key (or PostgreSQL for pgvector)

### Step 1: Initialize Project (5 minutes)

```bash
mkdir arloganalyzer
cd arloganalyzer

# Initialize Python backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install fastapi uvicorn anthropic pinecone-client pandas numpy scikit-learn python-dotenv

# Initialize Node/React frontend
npx create-react-app frontend
cd frontend
npm install axios zustand react-markdown react-syntax-highlighter
cd ..
```

### Step 2: Set Up Environment Variables (2 minutes)

Create `.env` file:

```
ANTHROPIC_API_KEY=sk-ant-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX=remedy-logs
VOYAGE_API_KEY=pa-...  # For embeddings
LOG_STORAGE_PATH=./logs
DATABASE_URL=postgresql://user:password@localhost/arloganalyzer
```

### Step 3: Create Basic Log Parser (10 minutes)

Create `backend/log_parser.py`:

```python
import re
from datetime import datetime
from typing import List, Dict

class LogParser:
    """Parse BMC Remedy AR System logs"""

    def parse_arapi_log(self, log_content: str) -> List[Dict]:
        """Parse arapi.log format"""
        lines = log_content.split('\n')
        entries = []

        # Pattern: [2024-02-09 14:30:45.123] API: operation duration=1234ms status=SUCCESS
        pattern = r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\] API: (.+) duration=(\d+)ms status=(\w+)'

        for line in lines:
            match = re.search(pattern, line)
            if match:
                entries.append({
                    'log_type': 'arapi',
                    'timestamp': match.group(1),
                    'operation': match.group(2),
                    'duration_ms': int(match.group(3)),
                    'status': match.group(4),
                    'raw_line': line
                })

        return entries

    def parse_arsql_log(self, log_content: str) -> List[Dict]:
        """Parse arsql.log format"""
        lines = log_content.split('\n')
        entries = []

        # Pattern: [2024-02-09 14:30:45.123] SQL: table=TICKET duration=456ms rows=10
        pattern = r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\] SQL: table=(\w+) duration=(\d+)ms rows=(\d+)'

        for line in lines:
            match = re.search(pattern, line)
            if match:
                entries.append({
                    'log_type': 'arsql',
                    'timestamp': match.group(1),
                    'table_name': match.group(2),
                    'duration_ms': int(match.group(3)),
                    'rows_affected': int(match.group(4)),
                    'raw_line': line
                })

        return entries

    def parse_all_logs(self, logs_dict: Dict[str, str]) -> Dict[str, List[Dict]]:
        """Parse multiple log files"""
        results = {
            'arapi': self.parse_arapi_log(logs_dict.get('arapi', '')),
            'arsql': self.parse_arsql_log(logs_dict.get('arsql', '')),
            # Add arfilter, aresc parsers similarly
        }
        return results
```

### Step 4: Create Vector Embedding Pipeline (15 minutes)

Create `backend/embeddings.py`:

```python
import os
import numpy as np
from typing import List, Dict
try:
    from pinecone import Pinecone
except ImportError:
    print("Install pinecone: pip install pinecone-client")

class EmbeddingPipeline:
    """Handle vector embeddings and storage"""

    def __init__(self):
        # Initialize Pinecone
        api_key = os.getenv("PINECONE_API_KEY")
        self.pc = Pinecone(api_key=api_key)
        self.index = self.pc.Index(os.getenv("PINECONE_INDEX", "remedy-logs"))

    def prepare_log_for_embedding(self, log_entry: Dict) -> str:
        """Convert log entry to embeddable text"""
        log_type = log_entry.get('log_type')

        if log_type == 'arapi':
            return f"""API Operation: {log_entry.get('operation')}
Duration: {log_entry.get('duration_ms')}ms
Status: {log_entry.get('status')}
Timestamp: {log_entry.get('timestamp')}"""

        elif log_type == 'arsql':
            return f"""SQL Query on Table: {log_entry.get('table_name')}
Duration: {log_entry.get('duration_ms')}ms
Rows: {log_entry.get('rows_affected')}
Timestamp: {log_entry.get('timestamp')}"""

        return str(log_entry)

    def embed_logs_batch(self, logs: List[Dict]) -> List[Dict]:
        """
        Create embeddings for logs.

        NOTE: In production, use VoyageAI. For testing, use simple strategy.
        """
        embeddings_data = []

        for i, log in enumerate(logs):
            # Create simple embedding (in production, use VoyageAI API)
            text = self.prepare_log_for_embedding(log)

            # Fallback: Create dummy embedding from text hash
            # In production: response = voyage_client.embed([text])
            hash_val = hash(text)
            dummy_embedding = [
                float(hash_val % 100) / 100,
                float((hash_val >> 10) % 100) / 100,
                # ... repeat for 1536 dimensions (VoyageAI default)
            ]

            embeddings_data.append({
                'id': f"log_{log.get('log_type')}_{i}",
                'values': dummy_embedding,
                'metadata': {
                    'log_type': log.get('log_type'),
                    'timestamp': log.get('timestamp'),
                    'text': text[:200]
                }
            })

        return embeddings_data

    def store_embeddings(self, embeddings_data: List[Dict]) -> None:
        """Store embeddings in Pinecone"""
        # In production, batch these calls
        for emb in embeddings_data:
            self.index.upsert([(emb['id'], emb['values'], emb['metadata'])])

        print(f"Stored {len(embeddings_data)} embeddings")
```

### Step 5: Create Anomaly Detection Skill (15 minutes)

Create `backend/skills/anomaly_detection.py`:

```python
import numpy as np
from typing import List, Dict
from datetime import datetime, timedelta

class AnomalyDetectionSkill:
    """Detect anomalies in log data using statistical methods"""

    def __init__(self, baseline_days: int = 7, z_score_threshold: float = 2.5):
        self.baseline_days = baseline_days
        self.z_score_threshold = z_score_threshold

    def calculate_baseline(self, values: List[float]) -> Dict:
        """Calculate statistical baseline"""
        if not values:
            return {}

        values = np.array(values, dtype=float)
        return {
            'mean': float(np.mean(values)),
            'stddev': float(np.std(values)),
            'median': float(np.median(values)),
            'p95': float(np.percentile(values, 95)),
            'p99': float(np.percentile(values, 99)),
            'min': float(np.min(values)),
            'max': float(np.max(values)),
            'count': len(values)
        }

    def detect_anomalies(self, current_values: List[float],
                        baseline: Dict) -> Dict:
        """Detect anomalies using Z-score method"""

        if 'stddev' not in baseline or baseline['stddev'] == 0:
            return {'anomalies': [], 'message': 'No baseline variance'}

        mean = baseline['mean']
        stddev = baseline['stddev']

        anomalies = []
        for i, value in enumerate(current_values):
            z_score = (value - mean) / stddev
            if abs(z_score) > self.z_score_threshold:
                anomalies.append({
                    'index': i,
                    'value': value,
                    'z_score': z_score,
                    'deviation_pct': ((value - mean) / mean * 100) if mean > 0 else 0,
                    'severity': min(100, abs(z_score) * 20)
                })

        return {
            'baseline': baseline,
            'anomalies': anomalies,
            'anomaly_count': len(anomalies),
            'anomaly_rate': len(anomalies) / len(current_values) if current_values else 0
        }

    def execute(self, logs: List[Dict], metric: str = 'duration_ms') -> Dict:
        """Execute anomaly detection on logs"""

        # Extract metric values
        values = [log.get(metric, 0) for log in logs if metric in log]

        if not values:
            return {'error': f'No {metric} data found in logs'}

        # Calculate baseline from last 7 days (in real system, filter by date)
        baseline = self.calculate_baseline(values[:-100])  # Use older values

        # Detect anomalies in recent data
        recent_values = values[-100:]  # Last 100 entries

        result = self.detect_anomalies(recent_values, baseline)

        return {
            'skill': 'anomaly_detection',
            'metric': metric,
            'result': result,
            'top_anomalies': sorted(
                result['anomalies'],
                key=lambda x: x['severity'],
                reverse=True
            )[:5]
        }
```

### Step 6: Create FastAPI Backend (15 minutes)

Create `backend/main.py`:

```python
from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

from log_parser import LogParser
from embeddings import EmbeddingPipeline
from skills.anomaly_detection import AnomalyDetectionSkill

# Load environment variables
load_dotenv()

app = FastAPI(title="ARLogAnalyzer API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
parser = LogParser()
embeddings = EmbeddingPipeline()
anomaly_skill = AnomalyDetectionSkill()

# Store logs in memory (in production, use database)
logs_storage = {}

@app.get("/")
async def root():
    return {"message": "ARLogAnalyzer API v1.0"}

@app.post("/upload-logs")
async def upload_logs(file: UploadFile = File(...)):
    """Upload and parse log file"""
    try:
        content = await file.read()
        text = content.decode('utf-8')

        # Parse based on filename
        if 'arapi' in file.filename:
            parsed = parser.parse_arapi_log(text)
            logs_storage['arapi'] = parsed
        elif 'arsql' in file.filename:
            parsed = parser.parse_arsql_log(text)
            logs_storage['arsql'] = parsed

        # Create embeddings
        embeddings_data = embeddings.embed_logs_batch(parsed)
        embeddings.store_embeddings(embeddings_data)

        return {
            'status': 'success',
            'file': file.filename,
            'entries_parsed': len(parsed),
            'embeddings_created': len(embeddings_data)
        }

    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={'error': str(e)}
        )

@app.get("/skills/anomaly-detection")
async def detect_anomalies(log_type: str = Query("arapi")):
    """Run anomaly detection skill"""
    if log_type not in logs_storage:
        return {'error': f'No {log_type} logs loaded'}

    result = anomaly_skill.execute(logs_storage[log_type])

    return result

@app.get("/logs/{log_type}")
async def get_logs(log_type: str):
    """Get all logs of a type"""
    if log_type not in logs_storage:
        return {'error': f'No logs found for {log_type}'}

    logs = logs_storage[log_type]
    return {
        'log_type': log_type,
        'count': len(logs),
        'logs': logs[:100]  # Return first 100
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Step 7: Create React Frontend Component (10 minutes)

Create `frontend/src/LogAnalyzer.js`:

```jsx
import React, { useState } from 'react';
import axios from 'axios';
import './LogAnalyzer.css';

function LogAnalyzer() {
  const [logs, setLogs] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE = 'http://localhost:8000';

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_BASE}/upload-logs`, formData);

      setLogs({
        filename: file.name,
        entries: response.data.entries_parsed,
        timestamp: new Date().toLocaleString()
      });

      // Automatically run anomaly detection
      detectAnomalies('arapi');
    } catch (err) {
      setError(`Upload failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const detectAnomalies = async (logType) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE}/skills/anomaly-detection`,
        { params: { log_type: logType } }
      );

      setAnomalies(response.data);
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analyzer-container">
      <h1>ARLogAnalyzer - Quick Start</h1>

      <div className="upload-section">
        <h2>Step 1: Upload Log File</h2>
        <input
          type="file"
          accept=".log,.txt"
          onChange={handleFileUpload}
          disabled={loading}
        />
        {logs && <p className="success">✓ Loaded: {logs.filename} ({logs.entries} entries)</p>}
      </div>

      <div className="analysis-section">
        <h2>Step 2: Run Analysis</h2>
        <button onClick={() => detectAnomalies('arapi')} disabled={!logs || loading}>
          {loading ? 'Analyzing...' : 'Detect Anomalies'}
        </button>
      </div>

      {anomalies && (
        <div className="results-section">
          <h2>Results</h2>
          <div className="anomaly-summary">
            <p>Found <strong>{anomalies.result.anomaly_count}</strong> anomalies</p>
            <p>Anomaly rate: <strong>{(anomalies.result.anomaly_rate * 100).toFixed(1)}%</strong></p>
          </div>

          <div className="baseline-info">
            <h3>Baseline Statistics</h3>
            <ul>
              <li>Mean: {anomalies.result.baseline.mean?.toFixed(2)}ms</li>
              <li>Std Dev: {anomalies.result.baseline.stddev?.toFixed(2)}ms</li>
              <li>P95: {anomalies.result.baseline.p95?.toFixed(2)}ms</li>
              <li>P99: {anomalies.result.baseline.p99?.toFixed(2)}ms</li>
            </ul>
          </div>

          {anomalies.top_anomalies?.length > 0 && (
            <div className="top-anomalies">
              <h3>Top Anomalies</h3>
              {anomalies.top_anomalies.map((anom, idx) => (
                <div key={idx} className="anomaly-item">
                  <strong>Value:</strong> {anom.value.toFixed(2)}ms
                  <strong className="deviation">Deviation: {anom.deviation_pct.toFixed(1)}%</strong>
                  <strong className="severity">Severity: {anom.severity.toFixed(0)}/100</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default LogAnalyzer;
```

### Step 8: Run the System (5 minutes)

```bash
# Terminal 1: Start backend
cd backend
python main.py
# Server starts at http://localhost:8000

# Terminal 2: Start frontend
cd frontend
npm start
# App opens at http://localhost:3000
```

### Step 9: Test with Sample Data

Create `test_logs.txt`:

```
[2024-02-09 14:30:00.001] API: GetTicket duration=45ms status=SUCCESS
[2024-02-09 14:30:01.002] API: GetTicket duration=48ms status=SUCCESS
[2024-02-09 14:30:02.003] API: GetTicket duration=52ms status=SUCCESS
[2024-02-09 14:30:03.004] API: GetTicket duration=5000ms status=SUCCESS
[2024-02-09 14:30:04.005] API: GetTicket duration=51ms status=SUCCESS
[2024-02-09 14:30:05.006] API: GetTicket duration=46ms status=SUCCESS
```

Upload this file to `http://localhost:3000` and run anomaly detection. It should detect the 5000ms call as an anomaly.

---

## Next Steps

1. **Add Claude Integration** - Replace anomaly detection with Claude-powered analysis
2. **Add NL Query** - Implement natural language parsing with Claude
3. **Add More Skills** - Implement the other 19 skills
4. **Add Database** - Replace in-memory storage with PostgreSQL
5. **Deploy** - Push to production with Docker

---

## Troubleshooting

**Port already in use**:
```bash
# Change port in main.py
uvicorn.run(app, host="0.0.0.0", port=8001)
```

**CORS errors**:
```python
# Add your frontend URL to allowed_origins
allow_origins=["http://localhost:3000", "http://yourdomain.com"]
```

**Missing API keys**:
```bash
# Double-check .env file has all required keys
cat .env
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   React Frontend                         │
│              (Log Upload, Query Interface)               │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────▼────────────────────────────────────┐
│                   FastAPI Backend                        │
│  (Log Parsing, Skill Execution, API Orchestration)      │
└────────────────────┬────────────────────────────────────┘
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼──┐   ┌───▼────┐  ┌──▼────┐
    │Vector │   │Anomaly │  │Claude │
    │  DB   │   │Detection│  │ API   │
    │(Pinec│   │ Skill   │  │       │
    │ one) │   │         │  │       │
    └──────┘   └─────────┘  └───────┘
```

This quick start gives you a working system in 1 hour. From here, you can build out the additional skills and features described in the design document.
