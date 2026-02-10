# RemedyIQ Backend Libraries - Context7 Documentation Reference

> Auto-generated from Context7 documentation. For use as a quick-reference during RemedyIQ development.

---

## Table of Contents

1. [NATS (nats-io/nats.go)](#1-nats-nats-ionatsgo)
2. [Redis (redis/go-redis)](#2-redis-redisgo-redis)
3. [MinIO (minio/minio-go)](#3-minio-miniominio-go)
4. [Gorilla Mux (gorilla/mux)](#4-gorilla-mux-gorillamux)
5. [pgx (jackc/pgx)](#5-pgx-jaccpgx)
6. [Bleve (blevesearch/bleve)](#6-bleve-blevesearchbleve)
7. [ClickHouse (clickhouse/clickhouse-go)](#7-clickhouse-clickhouseclickhouse-go)

---

## 1. NATS (`nats-io/nats.go`)

**Library ID:** `/nats-io/nats.go`
**Import:** `github.com/nats-io/nats.go` and `github.com/nats-io/nats.go/jetstream`

### Connection Setup

```go
import "github.com/nats-io/nats.go"

// Connect to NATS
nc, _ := nats.Connect(nats.DefaultURL)
```

### JetStream - Legacy API

```go
// Create JetStream Context
js, _ := nc.JetStream(nats.PublishAsyncMaxPending(256))

// Create a Stream
js.AddStream(&nats.StreamConfig{
    Name:     "ORDERS",
    Subjects: []string{"ORDERS.*"},
})

// Update a Stream
js.UpdateStream(&nats.StreamConfig{
    Name:     "ORDERS",
    MaxBytes: 8,
})

// Create a Consumer
js.AddConsumer("ORDERS", &nats.ConsumerConfig{
    Durable: "MONITOR",
})

// Delete Consumer
js.DeleteConsumer("ORDERS", "MONITOR")

// Delete Stream
js.DeleteStream("ORDERS")
```

### Publishing Messages

```go
// Synchronous publish
js.Publish("ORDERS.scratch", []byte("hello"))

// Async publish with completion tracking
for i := 0; i < 500; i++ {
    js.PublishAsync("ORDERS.scratch", []byte("hello"))
}
select {
case <-js.PublishAsyncComplete():
case <-time.After(5 * time.Second):
    fmt.Println("Did not resolve in time")
}
```

### Subscribing / Consuming (Legacy)

```go
// Async Ephemeral Consumer
js.Subscribe("ORDERS.*", func(m *nats.Msg) {
    fmt.Printf("Received a JetStream message: %s\n", string(m.Data))
})

// Sync Durable Consumer
sub, err := js.SubscribeSync("ORDERS.*", nats.Durable("MONITOR"), nats.MaxDeliver(3))
m, err := sub.NextMsg(timeout)

// Pull Consumer
sub, err := js.PullSubscribe("ORDERS.*", "MONITOR")
msgs, err := sub.Fetch(10)

// Unsubscribe / Drain
sub.Unsubscribe()
sub.Drain()
```

### JetStream - New API (Recommended)

```go
import (
    "context"
    "github.com/nats-io/nats.go"
    "github.com/nats-io/nats.go/jetstream"
)

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
nc, _ := nats.Connect(nats.DefaultURL)

// Create a JetStream management interface
js, _ := jetstream.New(nc)

// Create a stream
s, _ := js.CreateStream(ctx, jetstream.StreamConfig{
    Name:     "ORDERS",
    Subjects: []string{"ORDERS.*"},
})

// Publish messages
js.Publish(ctx, "ORDERS.new", []byte("hello message"))

// Create durable consumer
c, _ := s.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
    Durable:   "CONS",
    AckPolicy: jetstream.AckExplicitPolicy,
})

// Fetch messages (batch)
msgs, _ := c.Fetch(10)
for msg := range msgs.Messages() {
    msg.Ack()
    fmt.Printf("Received: %s\n", string(msg.Data()))
}

// Consume with callback
cons, _ := c.Consume(func(msg jetstream.Msg) {
    msg.Ack()
    fmt.Printf("Received via callback: %s\n", string(msg.Data()))
})
defer cons.Stop()

// Consume with iterator
it, _ := c.Messages()
for i := 0; i < 10; i++ {
    msg, _ := it.Next()
    msg.Ack()
}
it.Stop()
```

### Consumer CRUD (New API)

```go
js, _ := jetstream.New(nc)

// Create (idempotent - errors if different config exists)
cons, _ := js.CreateConsumer(ctx, "ORDERS", jetstream.ConsumerConfig{
    Durable:   "foo",
    AckPolicy: jetstream.AckExplicitPolicy,
})

// Create ephemeral (no Durable field)
ephemeral, _ := js.CreateConsumer(ctx, "ORDERS", jetstream.ConsumerConfig{
    AckPolicy: jetstream.AckExplicitPolicy,
})

// Create or Update
cons2 := js.CreateOrUpdateConsumer(ctx, "ORDERS", jetstream.ConsumerConfig{
    Name: "bar",
})

// Update existing
updated, _ := js.UpdateConsumer(ctx, "ORDERS", jetstream.ConsumerConfig{
    AckPolicy:   jetstream.AckExplicitPolicy,
    Description: "updated consumer",
})

// Get consumer handle
cons, _ = js.Consumer(ctx, "ORDERS", "foo")

// Delete
js.DeleteConsumer(ctx, "ORDERS", "foo")
```

### Queue Groups

```go
// All subscribers with the same queue name form a group.
// Each message is delivered to only one subscriber per group.
nc.QueueSubscribe("foo", "job_workers", func(_ *nats.Msg) {
    // process message
})
```

---

## 2. Redis (`redis/go-redis`)

**Library ID:** `/redis/go-redis`
**Import:** `github.com/redis/go-redis/v9`

### Basic Client Connection

```go
import (
    "context"
    "github.com/redis/go-redis/v9"
)

ctx := context.Background()

// Basic client
rdb := redis.NewClient(&redis.Options{
    Addr:     "localhost:6379",
    Password: "",  // no password set
    DB:       0,   // use default DB
})
defer rdb.Close()

// Test connection
pong, err := rdb.Ping(ctx).Result()
```

### Full Connection Pool Configuration

```go
rdb := redis.NewClient(&redis.Options{
    Addr:         "localhost:6379",
    Username:     "default",           // Redis 6.0+ ACL username
    Password:     "secret",
    DB:           0,
    Protocol:     3,                   // RESP3 protocol (default)

    // Connection pool settings
    PoolSize:     10,                  // Default: 10 * runtime.GOMAXPROCS
    MinIdleConns: 5,
    MaxIdleConns: 10,
    MaxActiveConns: 100,

    // Timeouts
    DialTimeout:  5 * time.Second,
    ReadTimeout:  3 * time.Second,
    WriteTimeout: 3 * time.Second,
    PoolTimeout:  4 * time.Second,

    // Connection lifetime
    ConnMaxIdleTime: 30 * time.Minute,
    ConnMaxLifetime: 0,                // no max lifetime

    // Retry settings
    MaxRetries:      3,
    MinRetryBackoff: 8 * time.Millisecond,
    MaxRetryBackoff: 512 * time.Millisecond,
})
```

### Basic String Operations (GET / SET)

```go
// SET with expiration
err := rdb.Set(ctx, "key", "value", 10*time.Minute).Err()

// SET without expiration
err = rdb.Set(ctx, "persistent-key", "value", 0).Err()

// GET
val, err := rdb.Get(ctx, "key").Result()

// Handle key not found
val, err = rdb.Get(ctx, "nonexistent").Result()
if errors.Is(err, redis.Nil) {
    fmt.Println("key does not exist")
}

// SETNX - Set if not exists (great for distributed locks)
wasSet, err := rdb.SetNX(ctx, "unique-key", "value", time.Hour).Result()

// SETXX - Set only if exists
wasSet, err = rdb.SetXX(ctx, "key", "new-value", 0).Result()

// GETEX - Get and update expiration
val, err = rdb.GetEx(ctx, "key", time.Hour).Result()

// GETDEL - Get and delete
val, err = rdb.GetDel(ctx, "key").Result()
```

### Pipelining (Batch Commands)

```go
// Method 1: Using Pipelined callback
cmds, err := rdb.Pipelined(ctx, func(pipe redis.Pipeliner) error {
    pipe.Set(ctx, "key1", "value1", time.Hour)
    pipe.Set(ctx, "key2", "value2", time.Hour)
    pipe.Get(ctx, "key1")
    pipe.Get(ctx, "key2")
    pipe.Incr(ctx, "counter")
    return nil
})

// Method 2: Using Pipeline directly with typed commands
pipe := rdb.Pipeline()

setCmd := pipe.Set(ctx, "pipeline-key", "value", 0)
getCmd := pipe.Get(ctx, "pipeline-key")
incrCmd := pipe.Incr(ctx, "pipeline-counter")
hsetCmd := pipe.HSet(ctx, "pipeline-hash", "field1", "value1")

_, err = pipe.Exec(ctx)

// Access results with type safety
fmt.Println("SET result:", setCmd.Val())
fmt.Println("GET result:", getCmd.Val())
fmt.Println("INCR result:", incrCmd.Val())
fmt.Println("HSET result:", hsetCmd.Val())
```

### Cluster Client

```go
rdb := redis.NewClusterClient(&redis.ClusterOptions{
    Addrs: []string{
        "localhost:7000",
        "localhost:7001",
        "localhost:7002",
    },
    Password:       "",
    ReadOnly:       true,  // Route read commands to replicas
    RouteByLatency: true,  // Route to lowest latency node
    RouteRandomly:  false,
    PoolSize:       10,
    MinIdleConns:   5,
    DialTimeout:    5 * time.Second,
    ReadTimeout:    3 * time.Second,
    WriteTimeout:   3 * time.Second,
    MaxRetries:     3,
})

// Use hash tags for co-location (same slot)
rdb.Set(ctx, "user:{123}:profile", "data", 0)
rdb.Set(ctx, "user:{123}:settings", "data", 0)
rdb.Set(ctx, "user:{123}:sessions", "data", 0)

// Transaction on co-located keys
err = rdb.Watch(ctx, func(tx *redis.Tx) error {
    _, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
        pipe.Get(ctx, "user:{123}:profile")
        pipe.Get(ctx, "user:{123}:settings")
        return nil
    })
    return err
}, "user:{123}:profile", "user:{123}:settings")
```

---

## 3. MinIO (`minio/minio-go`)

**Library ID:** `/minio/minio-go`
**Import:** `github.com/minio/minio-go/v7` and `github.com/minio/minio-go/v7/pkg/credentials`

### Client Initialization

```go
import (
    "github.com/minio/minio-go/v7"
    "github.com/minio/minio-go/v7/pkg/credentials"
)

client, err := minio.New("localhost:9000", &minio.Options{
    Creds:  credentials.NewStaticV4("accessKeyID", "secretAccessKey", ""),
    Secure: false, // true for TLS/SSL
})
if err != nil {
    log.Fatalln(err)
}

// Set custom application info for User-Agent header
client.SetAppInfo("RemedyIQ", "1.0.0")
```

### Bucket Operations

```go
ctx := context.Background()

// Create bucket
err = client.MakeBucket(ctx, "my-bucket", minio.MakeBucketOptions{
    Region:        "us-east-1",
    ObjectLocking: false,
})
if err != nil {
    exists, errExists := client.BucketExists(ctx, "my-bucket")
    if errExists == nil && exists {
        log.Printf("Bucket already exists")
    } else {
        log.Fatalln(err)
    }
}

// Check if bucket exists
exists, err := client.BucketExists(ctx, "my-bucket")

// List all buckets
buckets, err := client.ListBuckets(ctx)
for _, bucket := range buckets {
    log.Printf("  - %s (created: %s)", bucket.Name, bucket.CreationDate)
}
```

### Upload Operations

```go
// Upload from io.Reader (PutObject)
file, _ := os.Open("/tmp/testfile.txt")
defer file.Close()
fileStat, _ := file.Stat()

uploadInfo, err := client.PutObject(ctx, "my-bucket", "my-object.txt", file, fileStat.Size(), minio.PutObjectOptions{
    ContentType: "text/plain",
    UserMetadata: map[string]string{
        "my-key": "my-value",
    },
    UserTags: map[string]string{
        "environment": "production",
        "team":        "engineering",
    },
})
log.Printf("Uploaded %s, size %d bytes, ETag: %s", "my-object.txt", uploadInfo.Size, uploadInfo.ETag)

// Upload from file path (FPutObject)
uploadInfo, err = client.FPutObject(ctx, "my-bucket", "document.pdf", "/tmp/document.pdf", minio.PutObjectOptions{
    ContentType: "application/pdf",
})
```

### Download Operations

```go
// Download to file (FGetObject)
err = client.FGetObject(ctx, "my-bucket", "document.pdf", "/tmp/local-document.pdf", minio.GetObjectOptions{})

// Download as stream (GetObject)
object, err := client.GetObject(ctx, "my-bucket", "my-object.txt", minio.GetObjectOptions{})
defer object.Close()

localFile, _ := os.Create("/tmp/downloaded-object.txt")
defer localFile.Close()
n, err := io.Copy(localFile, object)
log.Printf("Downloaded %d bytes", n)
```

### Delete Operations

```go
// Remove a single object
err = client.RemoveObject(ctx, "my-bucket", "my-object.txt", minio.RemoveObjectOptions{})
```

### Presigned URLs

```go
// Presigned GET URL (download) - valid for 1 hour
presignedURL, err := client.PresignedGetObject(ctx, "my-bucket", "my-object.txt", time.Hour, nil)

// Presigned GET with response headers override
reqParams := make(url.Values)
reqParams.Set("response-content-disposition", "attachment; filename=\"your-filename.txt\"")
presignedURL, err = client.PresignedGetObject(ctx, "my-bucket", "my-object.txt", 24*time.Hour, reqParams)

// Presigned PUT URL (upload) - valid for 10 minutes
presignedURL, err = client.PresignedPutObject(ctx, "my-bucket", "upload-object.txt", 10*time.Minute)
// Usage: curl -X PUT --upload-file myfile.txt '<presignedURL>'

// Presigned POST with policy
policy := minio.NewPostPolicy()
policy.SetBucket("mybucket")
policy.SetKey("myobject")
policy.SetExpires(time.Now().UTC().AddDate(0, 0, 10))
policy.SetContentType("image/png")
policy.SetContentLengthRange(1024, 1024*1024)
policy.SetUserMetadata("custom", "user")

url, formData, err := client.PresignedPostPolicy(ctx, policy)
```

---

## 4. Gorilla Mux (`gorilla/mux`)

**Library ID:** `/gorilla/mux`
**Import:** `github.com/gorilla/mux`

### Basic Router Setup

```go
import (
    "log"
    "net/http"
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()
    r.HandleFunc("/", YourHandler)
    log.Fatal(http.ListenAndServe(":8000", r))
}

func YourHandler(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("Gorilla!\n"))
}
```

### Path Variables and Pattern Matching

```go
r := mux.NewRouter()

// Simple path variable
r.HandleFunc("/products/{key}", ProductHandler)

// Path variable with regex constraint
r.HandleFunc("/articles/{category}/", ArticlesCategoryHandler)
r.HandleFunc("/articles/{category}/{id:[0-9]+}", ArticleHandler)

// Extracting variables in handler
func ArticlesCategoryHandler(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    w.WriteHeader(http.StatusOK)
    fmt.Fprintf(w, "Category: %v\n", vars["category"])
}
```

### Query Parameter Matching

```go
// Match routes based on query parameters
r.Queries("key", "value")
```

### Named Routes and URL Building

```go
r := mux.NewRouter()
r.HandleFunc("/articles/{category}/{id:[0-9]+}", ArticleHandler).
    Name("article")

// Generate URL from named route
url, err := r.Get("article").URL("category", "technology", "id", "42")
// url.Path == "/articles/technology/42"
```

### Subrouters

```go
r := mux.NewRouter()

// Subrouter scoped to host
s := r.Host("www.example.com").Subrouter()

// Subrouter for API versioning (common pattern)
api := r.PathPrefix("/api/v1").Subrouter()
api.HandleFunc("/users", UsersHandler).Methods("GET")
api.HandleFunc("/users/{id}", UserHandler).Methods("GET", "PUT", "DELETE")
```

### Middleware

```go
r := mux.NewRouter()
r.HandleFunc("/", handler)

// Attach middleware to all routes
r.Use(loggingMiddleware)

// Example middleware function
func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        log.Println(r.RequestURI)
        next.ServeHTTP(w, r)
    })
}
```

### CORS Handling

```go
r := mux.NewRouter()

// Must specify OPTIONS method for CORSMethodMiddleware to work
r.HandleFunc("/foo", fooHandler).Methods(http.MethodGet, http.MethodPut, http.MethodPatch, http.MethodOptions)
r.Use(mux.CORSMethodMiddleware(r))

func fooHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    if r.Method == http.MethodOptions {
        return
    }
    w.Write([]byte("foo"))
}
```

### Walking Registered Routes (Debugging)

```go
r.Walk(func(route *mux.Route, router *mux.Router, ancestors []*mux.Route) error {
    pathTemplate, _ := route.GetPathTemplate()
    methods, _ := route.GetMethods()
    fmt.Printf("ROUTE: %s [%s]\n", pathTemplate, strings.Join(methods, ","))
    return nil
})
```

---

## 5. pgx (`jackc/pgx`)

**Library ID:** `/jackc/pgx`
**Import:** `github.com/jackc/pgx/v5` and `github.com/jackc/pgx/v5/pgxpool`

### Single Connection

```go
import (
    "context"
    "github.com/jackc/pgx/v5"
)

// URL format: postgres://username:password@localhost:5432/database_name
conn, err := pgx.Connect(context.Background(), os.Getenv("DATABASE_URL"))
if err != nil {
    fmt.Fprintf(os.Stderr, "Unable to connect: %v\n", err)
    os.Exit(1)
}
defer conn.Close(context.Background())
```

### Connection Pool (Recommended for Web Servers)

```go
import "github.com/jackc/pgx/v5/pgxpool"

// Basic pool
pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
if err != nil {
    fmt.Fprintf(os.Stderr, "Unable to create pool: %v\n", err)
    os.Exit(1)
}
defer pool.Close()
```

### Connection Pool with Full Configuration

```go
config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
if err != nil {
    fmt.Fprintf(os.Stderr, "Unable to parse config: %v\n", err)
    os.Exit(1)
}

// Configure pool settings
config.MaxConns = 10
config.MinConns = 2
config.MaxConnLifetime = time.Hour
config.MaxConnIdleTime = 30 * time.Minute
config.HealthCheckPeriod = time.Minute

// AfterConnect hook for connection setup
config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
    _, err := conn.Exec(ctx, "SET timezone = 'UTC'")
    return err
}

pool, err := pgxpool.NewWithConfig(context.Background(), config)
if err != nil {
    fmt.Fprintf(os.Stderr, "Unable to create pool: %v\n", err)
    os.Exit(1)
}
defer pool.Close()

// Check pool statistics
stats := pool.Stat()
fmt.Printf("Total: %d, Idle: %d, In use: %d\n",
    stats.TotalConns(), stats.IdleConns(), stats.AcquiredConns())
```

### Query Single Row

```go
var name string
var weight int64
err = conn.QueryRow(context.Background(),
    "SELECT name, weight FROM widgets WHERE id=$1", 42,
).Scan(&name, &weight)
if err != nil {
    fmt.Fprintf(os.Stderr, "QueryRow failed: %v\n", err)
}
```

### Query Multiple Rows

```go
func listUsers(ctx context.Context, conn *pgx.Conn, minAge int) error {
    rows, err := conn.Query(ctx,
        "SELECT id, name, email FROM users WHERE age >= $1 ORDER BY name",
        minAge,
    )
    if err != nil {
        return fmt.Errorf("query failed: %w", err)
    }
    defer rows.Close()

    for rows.Next() {
        var id int
        var name, email string

        if err := rows.Scan(&id, &name, &email); err != nil {
            return fmt.Errorf("scan failed: %w", err)
        }
        fmt.Printf("ID: %d, Name: %s, Email: %s\n", id, name, email)
    }

    // Always check for iteration errors
    if err := rows.Err(); err != nil {
        return fmt.Errorf("rows error: %w", err)
    }
    return nil
}
```

### Transactions

```go
func transferMoney(ctx context.Context, conn *pgx.Conn, fromID, toID int, amount float64) error {
    tx, err := conn.Begin(ctx)
    if err != nil {
        return fmt.Errorf("begin transaction failed: %w", err)
    }
    // Rollback is safe to call even if tx is already committed
    defer tx.Rollback(ctx)

    // Deduct from source account
    commandTag, err := tx.Exec(ctx,
        "UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1",
        amount, fromID,
    )
    if err != nil {
        return fmt.Errorf("deduct failed: %w", err)
    }
    if commandTag.RowsAffected() == 0 {
        return fmt.Errorf("insufficient funds or account not found")
    }

    // Add to destination account
    commandTag, err = tx.Exec(ctx,
        "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
        amount, toID,
    )
    if err != nil {
        return fmt.Errorf("credit failed: %w", err)
    }
    if commandTag.RowsAffected() == 0 {
        return fmt.Errorf("destination account not found")
    }

    // Commit the transaction
    if err := tx.Commit(ctx); err != nil {
        return fmt.Errorf("commit failed: %w", err)
    }
    return nil
}
```

### Using Pool (Same API as Conn)

```go
// Pool methods mirror Conn methods - use pool directly
var count int
err = pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM users").Scan(&count)

// pool.Query(), pool.Exec(), pool.Begin() all work the same way
```

---

## 6. Bleve (`blevesearch/bleve`)

**Library ID:** `/blevesearch/bleve`
**Import:** `github.com/blevesearch/bleve/v2`

### Creating an Index

```go
import "github.com/blevesearch/bleve/v2"

// Create index with default mapping
mapping := bleve.NewIndexMapping()
index, err := bleve.New("example.bleve", mapping)
if err != nil {
    panic(err)
}
```

### Indexing Documents

```go
message := struct {
    Id   string
    From string
    Body string
}{
    Id:   "example",
    From: "xyz@couchbase.com",
    Body: "bleve indexing is easy",
}

// Index a document by its ID
index.Index(message.Id, message)
```

### Querying / Searching

```go
// Open an existing index
index, _ := bleve.Open("example.bleve")

// Create a query and search
query := bleve.NewQueryStringQuery("bleve")
searchRequest := bleve.NewSearchRequest(query)
searchResult, _ := index.Search(searchRequest)
```

### Custom Field Mapping

```go
textFieldMapping := bleve.NewTextFieldMapping()
vectorFieldMapping := bleve.NewVectorFieldMapping()
vectorFieldMapping.Dims = 10
vectorFieldMapping.Similarity = "l2_norm" // euclidean distance

bleveMapping := bleve.NewIndexMapping()
bleveMapping.DefaultMapping.Dynamic = false
bleveMapping.DefaultMapping.AddFieldMappingsAt("text", textFieldMapping)
bleveMapping.DefaultMapping.AddFieldMappingsAt("vec", vectorFieldMapping)

index, err := bleve.New("example.bleve", bleveMapping)
```

### Indexing with Vector Fields

```go
doc := struct {
    Id   string    `json:"id"`
    Text string    `json:"text"`
    Vec  []float32 `json:"vec"`
}{
    Id:   "example",
    Text: "hello from united states",
    Vec:  []float32{0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
}

index.Index(doc.Id, doc)
```

### Vector Search (kNN)

```go
// Pure vector search
searchRequest := bleve.NewSearchRequest(bleve.NewMatchNoneQuery())
searchRequest.AddKNN(
    "vec",                                      // Vector field name
    []float32{0, 1, 1, 4, 4, 5, 7, 6, 8, 9},  // Query vector
    5,                                          // k nearest neighbors
    1,                                          // Boost factor
)
searchResult, _ := index.Search(searchRequest)
```

### Hybrid Search (Text + Vector)

```go
// Combine text query with vector similarity
hybridRequest := bleve.NewSearchRequest(bleve.NewMatchQuery("united states"))
hybridRequest.AddKNN(
    "vec",
    []float32{0, 1, 1, 4, 4, 5, 7, 6, 8, 9},
    5,
    1,
)
hybridResult, _ := index.Search(hybridRequest)
// Scores = text_score + kNN_score
```

### Vector Search Configuration Reference

- **Supported Similarity Metrics:** `"cosine"`, `"dot_product"`, `"l2_norm"` (euclidean)
- **Supported Dimensionality:** 1 to 4096 (v2.4.1+)
- **Vector Index Optimizations:** `"latency"`, `"memory_efficient"`, `"recall"`
- **kNN Operator:** `"union"` (default) or `"and"` for multi-kNN
- **Hybrid Score:** `aggregate_score = (query_boost * query_hit_score) + (knn_boost * knn_hit_distance)`

---

## 7. ClickHouse (`clickhouse/clickhouse-go`)

**Library ID:** `/clickhouse/clickhouse-go`
**Import:** `github.com/ClickHouse/clickhouse-go/v2`

### Native Interface Connection

```go
import "github.com/ClickHouse/clickhouse-go/v2"

conn, err := clickhouse.Open(&clickhouse.Options{
    Addr: []string{"127.0.0.1:9000"},
    Auth: clickhouse.Auth{
        Database: "default",
        Username: "default",
        Password: "",
    },
    Settings: clickhouse.Settings{
        "max_execution_time": 60,
    },
    Compression: &clickhouse.Compression{
        Method: clickhouse.CompressionLZ4,
    },
    DialTimeout:          time.Second * 30,
    BlockBufferSize:      10,
    MaxCompressionBuffer: 10240,
})
if err != nil {
    panic(err)
}
defer conn.Close()
```

### database/sql Interface Connection

```go
import (
    "database/sql"
    "github.com/ClickHouse/clickhouse-go/v2"
)

// Option 1: Using OpenDB with Options struct
conn := clickhouse.OpenDB(&clickhouse.Options{
    Addr: []string{"127.0.0.1:9000"},
    Auth: clickhouse.Auth{
        Database: "default",
        Username: "default",
        Password: "",
    },
    TLS: &tls.Config{
        InsecureSkipVerify: true,
    },
    Settings: clickhouse.Settings{
        "max_execution_time": 60,
    },
    Compression: &clickhouse.Compression{
        Method: clickhouse.CompressionLZ4,
    },
    DialTimeout: time.Second * 30,
    Debug:       true,
    ClientInfo: clickhouse.ClientInfo{
        Products: []struct {
            Name    string
            Version string
        }{
            {Name: "remedyiq", Version: "0.1"},
        },
    },
})
conn.SetMaxIdleConns(5)
conn.SetMaxOpenConns(10)
conn.SetConnMaxLifetime(time.Hour)

// Option 2: Using DSN string
dsn := "clickhouse://default:@127.0.0.1:9000/default?dial_timeout=30s&max_execution_time=60"
db, err := sql.Open("clickhouse", dsn)
```

### HTTP / HTTPS Protocol Connection

```go
// HTTP protocol (useful for proxy/load balancer scenarios)
conn := clickhouse.OpenDB(&clickhouse.Options{
    Addr: []string{"127.0.0.1:8123"},
    Auth: clickhouse.Auth{
        Database: "default",
        Username: "default",
        Password: "",
    },
    Protocol: clickhouse.HTTP,
    Settings: clickhouse.Settings{
        "max_execution_time": 60,
    },
    Compression: &clickhouse.Compression{
        Method: clickhouse.CompressionLZ4,
    },
    DialTimeout: 30 * time.Second,
})

// HTTP DSN
db, _ := sql.Open("clickhouse", "http://default:@127.0.0.1:8123/default?dial_timeout=30s")

// HTTPS DSN
httpsDB, _ := sql.Open("clickhouse", "https://default:@127.0.0.1:8443/default?secure=true")
```

### Creating Tables

```go
ctx := context.Background()

err = conn.Exec(ctx, `
    CREATE TABLE IF NOT EXISTS example (
        Col1 UInt8,
        Col2 String,
        Col3 FixedString(3),
        Col4 UUID,
        Col5 Map(String, UInt8),
        Col6 Array(String),
        Col7 Tuple(String, UInt8, Array(Map(String, String))),
        Col8 DateTime
    ) ENGINE = MergeTree() ORDER BY Col1
`)
```

### Batch Insert (Native Interface - Recommended for Performance)

```go
batch, err := conn.PrepareBatch(ctx, "INSERT INTO example")
if err != nil {
    panic(err)
}

for i := 0; i < 1000; i++ {
    err := batch.Append(
        uint8(42),
        "ClickHouse",
        "Inc",
        uuid.New(),
        map[string]uint8{"key": 1},
        []string{"Q", "W", "E", "R", "T", "Y"},
        []any{
            "String Value", uint8(5), []map[string]string{{"key": "value"}},
        },
        time.Now(),
    )
    if err != nil {
        panic(err)
    }
}

if err := batch.Send(); err != nil {
    panic(err)
}
```

### Batch Insert with Structs

```go
type Row struct {
    Col1       uint64
    Col2       string
    Col3       []uint8
    Col4       time.Time
    ColIgnored string // Extra fields are ignored
}

batch, _ := conn.PrepareBatch(ctx, "INSERT INTO example")

for i := 0; i < 1000; i++ {
    batch.AppendStruct(&Row{
        Col1: uint64(i),
        Col2: "Golang SQL database driver",
        Col3: []uint8{1, 2, 3, 4, 5},
        Col4: time.Now(),
    })
}

batch.Send()
```

### Batch Insert (database/sql Interface)

```go
tx, _ := conn.Begin()
stmt, _ := tx.Prepare("INSERT INTO example")

for i := 0; i < 1000; i++ {
    stmt.Exec(
        uint8(42),
        "ClickHouse", "Inc",
        uuid.New(),
        map[string]uint8{"key": 1},
        []string{"Q", "W", "E", "R", "T", "Y"},
        []any{"String Value", uint8(5), []map[string]string{{"key": "value"}}},
        time.Now(),
    )
}

tx.Commit()
```

### Querying with Select (into structs)

```go
var result []struct {
    Number uint64 `ch:"number"`
}
conn.Select(ctx, &result, "SELECT number FROM numbers(100)")
```

### Querying with QueryRow

```go
var one uint8
conn.QueryRow(ctx, "SELECT 1").Scan(&one)
```

### Querying with Query (row iteration)

```go
rows, err := conn.Query(ctx, "SELECT id, t_time, t_time64_9 FROM time_example ORDER BY id")
if err != nil {
    panic(err)
}
defer rows.Close()

for rows.Next() {
    var (
        id    uint32
        tTime time.Duration
    )
    if err := rows.Scan(&id, &tTime); err != nil {
        panic(err)
    }
    fmt.Printf("ID: %d, Time: %v\n", id, tTime)
}
```

### Context Options (Query-Specific Settings)

```go
// Context with custom settings
ctx := clickhouse.Context(context.Background(), clickhouse.WithSettings(clickhouse.Settings{
    "max_block_size": 10,
}))

// Context with query ID for tracing
queryID := uuid.New().String()
ctx = clickhouse.Context(context.Background(), clickhouse.WithQueryID(queryID))

// Context with progress, profile info, and logs
ctx = clickhouse.Context(context.Background(),
    clickhouse.WithProgress(func(p *clickhouse.Progress) {
        fmt.Printf("Progress: rows=%d, bytes=%d\n", p.Rows, p.Bytes)
    }),
    clickhouse.WithProfileInfo(func(p *clickhouse.ProfileInfo) {
        fmt.Printf("Profile: rows=%d, blocks=%d\n", p.Rows, p.Blocks)
    }),
    clickhouse.WithLogs(func(log *clickhouse.Log) {
        fmt.Printf("Log: %s\n", log.Text)
    }),
)

// Context with block buffer size and quota key
ctx = clickhouse.Context(context.Background(),
    clickhouse.WithBlockBufferSize(100),
    clickhouse.WithQuotaKey("my-quota-key"),
)
```

### DateTime64 and Time Types

```go
// Create table with Time/Time64 columns
conn.Exec(ctx, `
    CREATE TABLE IF NOT EXISTS time_example (
        id UInt32,
        t_time Time,
        t_time64_3 Time64(3),
        t_time64_6 Time64(6),
        t_time64_9 Time64(9),
        arr_time Array(Time),
        nullable_time Nullable(Time64(9))
    ) ENGINE = MergeTree() ORDER BY id
`)

// Insert using time.Duration
batch, _ := conn.PrepareBatch(ctx, "INSERT INTO time_example")

timeValue := 12*time.Hour + 34*time.Minute + 56*time.Second
time64Value := 15*time.Hour + 30*time.Minute + 45*time.Second + 123456789*time.Nanosecond

batch.Append(
    uint32(1),
    timeValue,
    time64Value,
    time64Value,
    time64Value,
    []time.Duration{6 * time.Hour, 12*time.Hour + 30*time.Minute},
    &time64Value, // nullable
)

// Insert NULL for nullable column
batch.Append(uint32(2), timeValue, time64Value, time64Value, time64Value,
    []time.Duration{6 * time.Hour}, nil)

batch.Send()
```

---

## Quick Reference: Import Paths

| Library | Import Path |
|---------|-------------|
| NATS | `github.com/nats-io/nats.go` |
| NATS JetStream (new) | `github.com/nats-io/nats.go/jetstream` |
| Redis | `github.com/redis/go-redis/v9` |
| MinIO | `github.com/minio/minio-go/v7` |
| MinIO Credentials | `github.com/minio/minio-go/v7/pkg/credentials` |
| Gorilla Mux | `github.com/gorilla/mux` |
| pgx | `github.com/jackc/pgx/v5` |
| pgx Pool | `github.com/jackc/pgx/v5/pgxpool` |
| Bleve | `github.com/blevesearch/bleve/v2` |
| ClickHouse | `github.com/ClickHouse/clickhouse-go/v2` |
