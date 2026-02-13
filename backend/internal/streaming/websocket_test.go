package streaming

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Topic naming helper tests
// ---------------------------------------------------------------------------

func TestJobProgressTopic(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		jobID    string
		expected string
	}{
		{
			name:     "standard IDs",
			tenantID: "tenant-1",
			jobID:    "job-abc",
			expected: "job_progress.tenant-1.job-abc",
		},
		{
			name:     "UUID-style IDs",
			tenantID: "00000000-0000-0000-0000-000000000001",
			jobID:    "11111111-1111-1111-1111-111111111111",
			expected: "job_progress.00000000-0000-0000-0000-000000000001.11111111-1111-1111-1111-111111111111",
		},
		{
			name:     "empty strings",
			tenantID: "",
			jobID:    "",
			expected: "job_progress..",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, jobProgressTopic(tt.tenantID, tt.jobID))
		})
	}
}

func TestJobCompleteTopic(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		jobID    string
		expected string
	}{
		{
			name:     "standard IDs",
			tenantID: "tenant-1",
			jobID:    "job-abc",
			expected: "job_complete.tenant-1.job-abc",
		},
		{
			name:     "UUID-style IDs",
			tenantID: "00000000-0000-0000-0000-000000000001",
			jobID:    "11111111-1111-1111-1111-111111111111",
			expected: "job_complete.00000000-0000-0000-0000-000000000001.11111111-1111-1111-1111-111111111111",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, jobCompleteTopic(tt.tenantID, tt.jobID))
		})
	}
}

func TestLiveTailTopic(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		logType  string
		expected string
	}{
		{
			name:     "SQL log type",
			tenantID: "tenant-1",
			logType:  "sql",
			expected: "live_tail.tenant-1.sql",
		},
		{
			name:     "exception log type",
			tenantID: "tenant-2",
			logType:  "exception",
			expected: "live_tail.tenant-2.exception",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, liveTailTopic(tt.tenantID, tt.logType))
		})
	}
}

// ---------------------------------------------------------------------------
// Hub lifecycle tests
// ---------------------------------------------------------------------------

func TestNewHub(t *testing.T) {
	hub := NewHub()
	require.NotNil(t, hub)
	assert.NotNil(t, hub.clients)
	assert.NotNil(t, hub.topics)
	assert.NotNil(t, hub.register)
	assert.NotNil(t, hub.unregister)
	assert.NotNil(t, hub.broadcast)
	assert.NotNil(t, hub.logger)
}

// startTestHub starts a hub's Run loop in a background goroutine and returns
// the hub. The event loop runs until the test completes.
func startTestHub(t *testing.T) *Hub {
	t.Helper()
	hub := NewHub()
	go hub.Run()
	return hub
}

// newTestClient creates a Client with the given hub and tenant, using a
// buffered send channel but no real WebSocket connection. Useful for testing
// hub registration, subscription, and broadcast logic.
func newTestClient(hub *Hub, tenantID string) *Client {
	return &Client{
		hub:           hub,
		tenantID:      tenantID,
		send:          make(chan []byte, sendBufferSize),
		subscriptions: make(map[string]struct{}),
		logger:        hub.logger.With("tenant", tenantID),
	}
}

func TestHubRegisterAndUnregister(t *testing.T) {
	hub := startTestHub(t)

	client := newTestClient(hub, "tenant-A")

	// Register client via the hub channel.
	hub.register <- client

	// Allow the event loop to process.
	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	_, exists := hub.clients["tenant-A"][client]
	hub.mu.RUnlock()
	assert.True(t, exists, "client should be registered under tenant-A")

	// Unregister.
	hub.unregister <- client
	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	tenantClients, tenantExists := hub.clients["tenant-A"]
	hub.mu.RUnlock()
	if tenantExists {
		_, stillRegistered := tenantClients[client]
		assert.False(t, stillRegistered, "client should be removed after unregister")
	}
}

func TestHubRegisterMultipleClients(t *testing.T) {
	hub := startTestHub(t)

	c1 := newTestClient(hub, "tenant-A")
	c2 := newTestClient(hub, "tenant-A")
	c3 := newTestClient(hub, "tenant-B")

	hub.register <- c1
	hub.register <- c2
	hub.register <- c3

	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	assert.Len(t, hub.clients["tenant-A"], 2, "tenant-A should have 2 clients")
	assert.Len(t, hub.clients["tenant-B"], 1, "tenant-B should have 1 client")
	hub.mu.RUnlock()
}

func TestHubUnregisterRemovesTenantMapWhenEmpty(t *testing.T) {
	hub := startTestHub(t)

	client := newTestClient(hub, "tenant-X")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	hub.unregister <- client
	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	_, exists := hub.clients["tenant-X"]
	hub.mu.RUnlock()
	assert.False(t, exists, "tenant entry should be removed when last client unregisters")
}

func TestHubUnregisterCleansUpTopicSubscriptions(t *testing.T) {
	hub := startTestHub(t)

	client := newTestClient(hub, "tenant-A")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	// Subscribe to some topics.
	require.NoError(t, hub.subscribe(client, "topic-1"))
	require.NoError(t, hub.subscribe(client, "topic-2"))

	// Verify subscriptions exist.
	hub.mu.RLock()
	assert.Len(t, hub.topics["topic-1"], 1)
	assert.Len(t, hub.topics["topic-2"], 1)
	hub.mu.RUnlock()

	// Unregister should clean up all topic subscriptions.
	hub.unregister <- client
	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	_, t1Exists := hub.topics["topic-1"]
	_, t2Exists := hub.topics["topic-2"]
	hub.mu.RUnlock()
	assert.False(t, t1Exists, "topic-1 should be removed after sole subscriber unregisters")
	assert.False(t, t2Exists, "topic-2 should be removed after sole subscriber unregisters")
}

// ---------------------------------------------------------------------------
// Subscribe / Unsubscribe tests
// ---------------------------------------------------------------------------

func TestHubSubscribe(t *testing.T) {
	hub := startTestHub(t)

	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	err := hub.subscribe(client, "job_progress.tenant-1.job-1")
	require.NoError(t, err)

	// Verify the client's subscription map.
	client.subsMu.Lock()
	_, subbed := client.subscriptions["job_progress.tenant-1.job-1"]
	client.subsMu.Unlock()
	assert.True(t, subbed)

	// Verify the hub's topics map.
	hub.mu.RLock()
	_, inTopic := hub.topics["job_progress.tenant-1.job-1"][client]
	hub.mu.RUnlock()
	assert.True(t, inTopic)
}

func TestHubSubscribeDuplicate(t *testing.T) {
	hub := startTestHub(t)

	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	require.NoError(t, hub.subscribe(client, "topic-A"))
	require.NoError(t, hub.subscribe(client, "topic-A")) // duplicate

	// Should still count as 1 subscription for the client.
	client.subsMu.Lock()
	count := len(client.subscriptions)
	client.subsMu.Unlock()
	assert.Equal(t, 1, count, "duplicate subscribe should not increase subscription count")
}

func TestHubSubscribeMaxSubscriptions(t *testing.T) {
	hub := startTestHub(t)

	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	// Fill up to the maximum.
	for i := 0; i < maxSubscriptions; i++ {
		err := hub.subscribe(client, topicName(i))
		require.NoError(t, err, "subscription %d should succeed", i)
	}

	// The next one should fail.
	err := hub.subscribe(client, "one-too-many")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "maximum subscriptions")
}

func topicName(i int) string {
	return "topic-" + string(rune('A'+i))
}

func TestHubUnsubscribe(t *testing.T) {
	hub := startTestHub(t)

	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	require.NoError(t, hub.subscribe(client, "topic-X"))

	hub.unsubscribe(client, "topic-X")

	client.subsMu.Lock()
	_, exists := client.subscriptions["topic-X"]
	client.subsMu.Unlock()
	assert.False(t, exists, "subscription should be removed from client")

	hub.mu.RLock()
	_, topicExists := hub.topics["topic-X"]
	hub.mu.RUnlock()
	assert.False(t, topicExists, "topic should be removed when last subscriber leaves")
}

func TestHubUnsubscribeNonExistent(t *testing.T) {
	hub := startTestHub(t)

	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	// Should not panic.
	hub.unsubscribe(client, "never-subscribed")
}

func TestHubUnsubscribePreservesOtherSubscribers(t *testing.T) {
	hub := startTestHub(t)

	c1 := newTestClient(hub, "tenant-1")
	c2 := newTestClient(hub, "tenant-1")
	hub.register <- c1
	hub.register <- c2
	time.Sleep(50 * time.Millisecond)

	require.NoError(t, hub.subscribe(c1, "shared-topic"))
	require.NoError(t, hub.subscribe(c2, "shared-topic"))

	hub.unsubscribe(c1, "shared-topic")

	hub.mu.RLock()
	subscribers := hub.topics["shared-topic"]
	_, c2StillThere := subscribers[c2]
	hub.mu.RUnlock()
	assert.True(t, c2StillThere, "other subscriber should remain")
}

// ---------------------------------------------------------------------------
// Broadcast tests
// ---------------------------------------------------------------------------

func TestHubBroadcastToTopic(t *testing.T) {
	hub := startTestHub(t)

	c1 := newTestClient(hub, "tenant-1")
	c2 := newTestClient(hub, "tenant-1")
	c3 := newTestClient(hub, "tenant-2") // different tenant, same topic name possible

	hub.register <- c1
	hub.register <- c2
	hub.register <- c3
	time.Sleep(50 * time.Millisecond)

	topic := "job_progress.tenant-1.job-42"
	require.NoError(t, hub.subscribe(c1, topic))
	require.NoError(t, hub.subscribe(c2, topic))
	// c3 is NOT subscribed

	msg := ServerMessage{Type: MsgTypeJobProgress, Payload: map[string]int{"progress_pct": 50}}
	hub.Broadcast(topic, msg)

	// Wait for the broadcast to be processed.
	time.Sleep(100 * time.Millisecond)

	// c1 and c2 should each have received a message.
	assert.Equal(t, 1, len(c1.send), "c1 should have 1 message")
	assert.Equal(t, 1, len(c2.send), "c2 should have 1 message")
	assert.Equal(t, 0, len(c3.send), "c3 should have 0 messages (not subscribed)")

	// Verify the message content for c1.
	raw := <-c1.send
	var received ServerMessage
	require.NoError(t, json.Unmarshal(raw, &received))
	assert.Equal(t, MsgTypeJobProgress, received.Type)
}

func TestHubBroadcastToEmptyTopic(t *testing.T) {
	hub := startTestHub(t)

	// Broadcast to a topic with no subscribers -- should not panic.
	msg := ServerMessage{Type: MsgTypeJobProgress, Payload: "nothing"}
	hub.Broadcast("nonexistent-topic", msg)

	// Allow the hub event loop to process.
	time.Sleep(50 * time.Millisecond)
}

func TestHubBroadcastBackpressure(t *testing.T) {
	hub := startTestHub(t)

	// Create a client with a tiny send buffer to trigger backpressure.
	client := &Client{
		hub:           hub,
		tenantID:      "tenant-bp",
		send:          make(chan []byte, 2), // very small buffer
		subscriptions: make(map[string]struct{}),
		logger:        hub.logger.With("tenant", "tenant-bp"),
	}
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	topic := "bp-topic"
	require.NoError(t, hub.subscribe(client, topic))

	// Fill the buffer completely.
	client.send <- []byte(`{"type":"old1"}`)
	client.send <- []byte(`{"type":"old2"}`)

	// Broadcast should not block or panic due to backpressure logic.
	msg := ServerMessage{Type: "new_msg", Payload: "data"}
	hub.Broadcast(topic, msg)

	time.Sleep(100 * time.Millisecond)

	// The channel should still have 2 items (old one dropped, new one added,
	// or the new one was dropped -- either way, no panic and no block).
	assert.LessOrEqual(t, len(client.send), 2, "channel should not exceed capacity")
}

// ---------------------------------------------------------------------------
// Concurrent access safety tests
// ---------------------------------------------------------------------------

func TestHubConcurrentRegistration(t *testing.T) {
	hub := startTestHub(t)

	var wg sync.WaitGroup
	numClients := 50

	for i := 0; i < numClients; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := newTestClient(hub, "concurrent-tenant")
			hub.register <- c
		}()
	}

	wg.Wait()
	time.Sleep(100 * time.Millisecond)

	hub.mu.RLock()
	count := len(hub.clients["concurrent-tenant"])
	hub.mu.RUnlock()
	assert.Equal(t, numClients, count)
}

func TestHubConcurrentSubscribeAndBroadcast(t *testing.T) {
	hub := startTestHub(t)

	numClients := 20
	clients := make([]*Client, numClients)
	for i := 0; i < numClients; i++ {
		clients[i] = newTestClient(hub, "concurrent-sub")
		hub.register <- clients[i]
	}
	time.Sleep(50 * time.Millisecond)

	topic := "concurrent-topic"
	var wg sync.WaitGroup

	// Subscribe all clients concurrently.
	for _, c := range clients {
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			_ = hub.subscribe(c, topic)
		}(c)
	}
	wg.Wait()

	// Broadcast concurrently while subscriptions may still be settling.
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			hub.Broadcast(topic, ServerMessage{Type: "event", Payload: i})
		}(i)
	}
	wg.Wait()

	time.Sleep(200 * time.Millisecond)

	// Every client should have received at least some messages.
	for i, c := range clients {
		assert.Greater(t, len(c.send), 0, "client %d should have received at least 1 message", i)
	}
}

func TestHubConcurrentRegisterUnregister(t *testing.T) {
	hub := startTestHub(t)

	var wg sync.WaitGroup
	numClients := 30

	clients := make([]*Client, numClients)
	for i := 0; i < numClients; i++ {
		clients[i] = newTestClient(hub, "churn-tenant")
		hub.register <- clients[i]
	}
	time.Sleep(50 * time.Millisecond)

	// Unregister half, register new ones concurrently.
	for i := 0; i < numClients/2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			hub.unregister <- clients[i]
		}(i)
	}
	for i := 0; i < numClients/2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := newTestClient(hub, "churn-tenant")
			hub.register <- c
		}()
	}

	wg.Wait()
	time.Sleep(100 * time.Millisecond)

	// We should not have panicked and the map should be consistent.
	hub.mu.RLock()
	count := len(hub.clients["churn-tenant"])
	hub.mu.RUnlock()
	assert.Equal(t, numClients, count, "should have numClients after half removed and half added")
}

// ---------------------------------------------------------------------------
// Client message handling tests
// ---------------------------------------------------------------------------

func TestClientHandleMessagePing(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	raw, err := json.Marshal(ClientMessage{Type: MsgTypePing})
	require.NoError(t, err)

	client.handleMessage(raw)

	require.Equal(t, 1, len(client.send))
	resp := <-client.send

	var msg ServerMessage
	require.NoError(t, json.Unmarshal(resp, &msg))
	assert.Equal(t, MsgTypePong, msg.Type)
}

func TestClientHandleMessageInvalidJSON(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	client.handleMessage([]byte(`{invalid json`))

	require.Equal(t, 1, len(client.send))
	resp := <-client.send

	var msg ServerMessage
	require.NoError(t, json.Unmarshal(resp, &msg))
	assert.Equal(t, MsgTypeError, msg.Type)
}

func TestClientHandleMessageUnknownType(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	raw, err := json.Marshal(ClientMessage{Type: "totally_unknown"})
	require.NoError(t, err)

	client.handleMessage(raw)

	require.Equal(t, 1, len(client.send))
	resp := <-client.send

	var msg ServerMessage
	require.NoError(t, json.Unmarshal(resp, &msg))
	assert.Equal(t, MsgTypeError, msg.Type)
}

func TestClientHandleSubscribeJobProgress(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	payload, _ := json.Marshal(SubscribeJobProgressPayload{JobID: "job-abc"})
	raw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeSubscribeJobProgress,
		Payload: payload,
	})

	client.handleMessage(raw)

	// Should be subscribed to both progress and complete topics.
	expectedProgress := jobProgressTopic("tenant-1", "job-abc")
	expectedComplete := jobCompleteTopic("tenant-1", "job-abc")

	client.subsMu.Lock()
	_, hasProgress := client.subscriptions[expectedProgress]
	_, hasComplete := client.subscriptions[expectedComplete]
	client.subsMu.Unlock()

	assert.True(t, hasProgress, "should be subscribed to progress topic")
	assert.True(t, hasComplete, "should be subscribed to complete topic")
}

func TestClientHandleSubscribeJobProgressEmptyJobID(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	payload, _ := json.Marshal(SubscribeJobProgressPayload{JobID: ""})
	raw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeSubscribeJobProgress,
		Payload: payload,
	})

	client.handleMessage(raw)

	require.Equal(t, 1, len(client.send))
	resp := <-client.send

	var msg ServerMessage
	require.NoError(t, json.Unmarshal(resp, &msg))
	assert.Equal(t, MsgTypeError, msg.Type)
}

func TestClientHandleSubscribeJobProgressInvalidPayload(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	raw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeSubscribeJobProgress,
		Payload: json.RawMessage(`"not_an_object"`),
	})

	client.handleMessage(raw)

	require.Equal(t, 1, len(client.send))
	resp := <-client.send

	var msg ServerMessage
	require.NoError(t, json.Unmarshal(resp, &msg))
	assert.Equal(t, MsgTypeError, msg.Type)
}

func TestClientHandleUnsubscribeJobProgress(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	// First subscribe.
	payload, _ := json.Marshal(SubscribeJobProgressPayload{JobID: "job-xyz"})
	subRaw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeSubscribeJobProgress,
		Payload: payload,
	})
	client.handleMessage(subRaw)

	// Now unsubscribe.
	unsubRaw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeUnsubscribeJobProgress,
		Payload: payload,
	})
	client.handleMessage(unsubRaw)

	expectedProgress := jobProgressTopic("tenant-1", "job-xyz")
	expectedComplete := jobCompleteTopic("tenant-1", "job-xyz")

	client.subsMu.Lock()
	_, hasProgress := client.subscriptions[expectedProgress]
	_, hasComplete := client.subscriptions[expectedComplete]
	client.subsMu.Unlock()

	assert.False(t, hasProgress, "should no longer be subscribed to progress topic")
	assert.False(t, hasComplete, "should no longer be subscribed to complete topic")
}

func TestClientHandleUnsubscribeJobProgressEmptyJobID(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	payload, _ := json.Marshal(SubscribeJobProgressPayload{JobID: ""})
	raw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeUnsubscribeJobProgress,
		Payload: payload,
	})

	client.handleMessage(raw)

	require.Equal(t, 1, len(client.send))
	resp := <-client.send

	var msg ServerMessage
	require.NoError(t, json.Unmarshal(resp, &msg))
	assert.Equal(t, MsgTypeError, msg.Type)
}

func TestClientHandleSubscribeLiveTail(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	payload, _ := json.Marshal(SubscribeLiveTailPayload{LogType: "sql"})
	raw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeSubscribeLiveTail,
		Payload: payload,
	})

	client.handleMessage(raw)

	expected := liveTailTopic("tenant-1", "sql")

	client.subsMu.Lock()
	_, subbed := client.subscriptions[expected]
	client.subsMu.Unlock()

	assert.True(t, subbed, "should be subscribed to live tail topic")
}

func TestClientHandleSubscribeLiveTailEmptyLogType(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	payload, _ := json.Marshal(SubscribeLiveTailPayload{LogType: ""})
	raw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeSubscribeLiveTail,
		Payload: payload,
	})

	client.handleMessage(raw)

	require.Equal(t, 1, len(client.send))
	resp := <-client.send

	var msg ServerMessage
	require.NoError(t, json.Unmarshal(resp, &msg))
	assert.Equal(t, MsgTypeError, msg.Type)
}

func TestClientHandleUnsubscribeLiveTail(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	// Subscribe first.
	payload, _ := json.Marshal(SubscribeLiveTailPayload{LogType: "sql"})
	subRaw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeSubscribeLiveTail,
		Payload: payload,
	})
	client.handleMessage(subRaw)

	// Unsubscribe.
	unsubRaw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeUnsubscribeLiveTail,
		Payload: payload,
	})
	client.handleMessage(unsubRaw)

	expected := liveTailTopic("tenant-1", "sql")

	client.subsMu.Lock()
	_, subbed := client.subscriptions[expected]
	client.subsMu.Unlock()

	assert.False(t, subbed, "should no longer be subscribed to live tail topic")
}

func TestClientHandleUnsubscribeLiveTailEmptyLogType(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	payload, _ := json.Marshal(SubscribeLiveTailPayload{LogType: ""})
	raw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeUnsubscribeLiveTail,
		Payload: payload,
	})

	client.handleMessage(raw)

	require.Equal(t, 1, len(client.send))
	resp := <-client.send

	var msg ServerMessage
	require.NoError(t, json.Unmarshal(resp, &msg))
	assert.Equal(t, MsgTypeError, msg.Type)
}

func TestClientHandleSubscribeMaxLimitError(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	// Fill up subscriptions to the max.
	for i := 0; i < maxSubscriptions; i++ {
		require.NoError(t, hub.subscribe(client, topicName(i)))
	}

	// Now try to subscribe via a message -- should get an error back.
	payload, _ := json.Marshal(SubscribeLiveTailPayload{LogType: "overflow"})
	raw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeSubscribeLiveTail,
		Payload: payload,
	})

	client.handleMessage(raw)

	require.Equal(t, 1, len(client.send))
	resp := <-client.send

	var msg ServerMessage
	require.NoError(t, json.Unmarshal(resp, &msg))
	assert.Equal(t, MsgTypeError, msg.Type)
}

// ---------------------------------------------------------------------------
// sendJSON / sendError tests
// ---------------------------------------------------------------------------

func TestClientSendJSON(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")

	msg := ServerMessage{Type: MsgTypePong}
	client.sendJSON(msg)

	require.Equal(t, 1, len(client.send))
	raw := <-client.send

	var received ServerMessage
	require.NoError(t, json.Unmarshal(raw, &received))
	assert.Equal(t, MsgTypePong, received.Type)
}

func TestClientSendError(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")

	client.sendError("TEST_CODE", "something went wrong")

	require.Equal(t, 1, len(client.send))
	raw := <-client.send

	var received ServerMessage
	require.NoError(t, json.Unmarshal(raw, &received))
	assert.Equal(t, MsgTypeError, received.Type)

	payloadBytes, err := json.Marshal(received.Payload)
	require.NoError(t, err)
	var errPayload ErrorPayload
	require.NoError(t, json.Unmarshal(payloadBytes, &errPayload))
	assert.Equal(t, "TEST_CODE", errPayload.Code)
	assert.Equal(t, "something went wrong", errPayload.Message)
}

func TestClientSendJSONBufferFull(t *testing.T) {
	hub := startTestHub(t)
	client := &Client{
		hub:           hub,
		tenantID:      "tenant-full",
		send:          make(chan []byte, 1), // capacity of 1
		subscriptions: make(map[string]struct{}),
		logger:        hub.logger.With("tenant", "tenant-full"),
	}

	// Fill the buffer.
	client.sendJSON(ServerMessage{Type: "fill"})

	// This should not block; it should drop the message silently.
	client.sendJSON(ServerMessage{Type: "dropped"})

	assert.Equal(t, 1, len(client.send), "buffer should still have exactly 1 message")
}

// ---------------------------------------------------------------------------
// Wire message serialization tests
// ---------------------------------------------------------------------------

func TestClientMessageSerialization(t *testing.T) {
	tests := []struct {
		name    string
		input   ClientMessage
		checkFn func(t *testing.T, decoded ClientMessage)
	}{
		{
			name:  "ping message",
			input: ClientMessage{Type: MsgTypePing},
			checkFn: func(t *testing.T, decoded ClientMessage) {
				assert.Equal(t, MsgTypePing, decoded.Type)
				assert.Nil(t, decoded.Payload)
			},
		},
		{
			name: "subscribe with payload",
			input: ClientMessage{
				Type:    MsgTypeSubscribeJobProgress,
				Payload: json.RawMessage(`{"job_id":"j1"}`),
			},
			checkFn: func(t *testing.T, decoded ClientMessage) {
				assert.Equal(t, MsgTypeSubscribeJobProgress, decoded.Type)
				var p SubscribeJobProgressPayload
				require.NoError(t, json.Unmarshal(decoded.Payload, &p))
				assert.Equal(t, "j1", p.JobID)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.input)
			require.NoError(t, err)

			var decoded ClientMessage
			require.NoError(t, json.Unmarshal(data, &decoded))

			tt.checkFn(t, decoded)
		})
	}
}

func TestServerMessageSerialization(t *testing.T) {
	tests := []struct {
		name    string
		input   ServerMessage
		checkFn func(t *testing.T, raw []byte)
	}{
		{
			name:  "pong with no payload",
			input: ServerMessage{Type: MsgTypePong},
			checkFn: func(t *testing.T, raw []byte) {
				assert.Contains(t, string(raw), `"type":"pong"`)
			},
		},
		{
			name: "error with payload",
			input: ServerMessage{
				Type:    MsgTypeError,
				Payload: ErrorPayload{Code: "BAD", Message: "oops"},
			},
			checkFn: func(t *testing.T, raw []byte) {
				assert.Contains(t, string(raw), `"type":"error"`)
				assert.Contains(t, string(raw), `"code":"BAD"`)
				assert.Contains(t, string(raw), `"message":"oops"`)
			},
		},
		{
			name: "job progress with numeric payload",
			input: ServerMessage{
				Type:    MsgTypeJobProgress,
				Payload: JobProgress{JobID: "j1", ProgressPct: 75, Status: "parsing"},
			},
			checkFn: func(t *testing.T, raw []byte) {
				assert.Contains(t, string(raw), `"progress_pct":75`)
				assert.Contains(t, string(raw), `"status":"parsing"`)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.input)
			require.NoError(t, err)
			tt.checkFn(t, data)
		})
	}
}

// ---------------------------------------------------------------------------
// Constants tests
// ---------------------------------------------------------------------------

func TestProtocolConstants(t *testing.T) {
	assert.Equal(t, 10*time.Second, writeWait)
	assert.Equal(t, 60*time.Second, pongWait)
	assert.Equal(t, 30*time.Second, pingPeriod)
	assert.Less(t, pingPeriod, pongWait, "pingPeriod must be less than pongWait")
	assert.Equal(t, 16*1024, maxMessageSize)
	assert.Equal(t, 1000, sendBufferSize)
	assert.Equal(t, 10, maxSubscriptions)
}

func TestMessageTypeConstants(t *testing.T) {
	// Client-to-server.
	assert.Equal(t, "subscribe_job_progress", MsgTypeSubscribeJobProgress)
	assert.Equal(t, "unsubscribe_job_progress", MsgTypeUnsubscribeJobProgress)
	assert.Equal(t, "subscribe_live_tail", MsgTypeSubscribeLiveTail)
	assert.Equal(t, "unsubscribe_live_tail", MsgTypeUnsubscribeLiveTail)
	assert.Equal(t, "ping", MsgTypePing)

	// Server-to-client.
	assert.Equal(t, "job_progress", MsgTypeJobProgress)
	assert.Equal(t, "job_complete", MsgTypeJobComplete)
	assert.Equal(t, "live_tail_entry", MsgTypeLiveTailEntry)
	assert.Equal(t, "error", MsgTypeError)
	assert.Equal(t, "pong", MsgTypePong)
}

// ---------------------------------------------------------------------------
// Real WebSocket upgrade tests (gorilla/websocket + httptest)
// ---------------------------------------------------------------------------

// upgrader is a test-friendly upgrader with no origin check.
var testUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// wsTestServer creates an httptest.Server that upgrades the connection and
// creates a real Client backed by the given hub. It returns the server URL
// (ws://...) and the server itself.
func wsTestServer(t *testing.T, hub *Hub) (*httptest.Server, string) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := testUpgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("upgrade: %v", err)
			return
		}
		client := NewClient(hub, conn, "ws-tenant")
		go client.ReadPump()
		go client.WritePump()
	}))

	t.Cleanup(server.Close)
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	return server, wsURL
}

func TestWebSocketUpgradeAndPing(t *testing.T) {
	hub := startTestHub(t)
	_, wsURL := wsTestServer(t, hub)

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	// Wait for registration.
	time.Sleep(100 * time.Millisecond)

	// Send a ping message.
	pingMsg := ClientMessage{Type: MsgTypePing}
	require.NoError(t, conn.WriteJSON(pingMsg))

	// Read the pong response.
	var resp ServerMessage
	require.NoError(t, conn.ReadJSON(&resp))
	assert.Equal(t, MsgTypePong, resp.Type)
}

func TestWebSocketSubscribeAndReceiveBroadcast(t *testing.T) {
	hub := startTestHub(t)
	_, wsURL := wsTestServer(t, hub)

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	time.Sleep(100 * time.Millisecond)

	// Subscribe to job progress.
	payload, _ := json.Marshal(SubscribeJobProgressPayload{JobID: "real-job-1"})
	subMsg := ClientMessage{
		Type:    MsgTypeSubscribeJobProgress,
		Payload: payload,
	}
	require.NoError(t, conn.WriteJSON(subMsg))

	time.Sleep(100 * time.Millisecond)

	// Broadcast a message from the hub.
	topic := jobProgressTopic("ws-tenant", "real-job-1")
	hub.Broadcast(topic, ServerMessage{
		Type: MsgTypeJobProgress,
		Payload: JobProgress{
			JobID:       "real-job-1",
			ProgressPct: 42,
			Status:      "parsing",
		},
	})

	// Read the broadcast message.
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var resp ServerMessage
	require.NoError(t, conn.ReadJSON(&resp))
	assert.Equal(t, MsgTypeJobProgress, resp.Type)
}

func TestWebSocketUnknownMessageType(t *testing.T) {
	hub := startTestHub(t)
	_, wsURL := wsTestServer(t, hub)

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	time.Sleep(100 * time.Millisecond)

	// Send an unknown message type.
	require.NoError(t, conn.WriteJSON(ClientMessage{Type: "bogus"}))

	// Should receive an error message back.
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var resp ServerMessage
	require.NoError(t, conn.ReadJSON(&resp))
	assert.Equal(t, MsgTypeError, resp.Type)
}

func TestWebSocketInvalidJSON(t *testing.T) {
	hub := startTestHub(t)
	_, wsURL := wsTestServer(t, hub)

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	time.Sleep(100 * time.Millisecond)

	// Send raw invalid JSON bytes.
	require.NoError(t, conn.WriteMessage(websocket.TextMessage, []byte(`{not valid`)))

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var resp ServerMessage
	require.NoError(t, conn.ReadJSON(&resp))
	assert.Equal(t, MsgTypeError, resp.Type)
}

func TestWebSocketMultipleClients(t *testing.T) {
	hub := startTestHub(t)
	_, wsURL := wsTestServer(t, hub)

	dialer := websocket.DefaultDialer

	conn1, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn1.Close()

	conn2, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn2.Close()

	time.Sleep(100 * time.Millisecond)

	// Both subscribe to the same job topic (they share tenant "ws-tenant").
	payload, _ := json.Marshal(SubscribeJobProgressPayload{JobID: "shared-job"})
	subMsg := ClientMessage{
		Type:    MsgTypeSubscribeJobProgress,
		Payload: payload,
	}
	require.NoError(t, conn1.WriteJSON(subMsg))
	require.NoError(t, conn2.WriteJSON(subMsg))

	time.Sleep(100 * time.Millisecond)

	// Broadcast.
	topic := jobProgressTopic("ws-tenant", "shared-job")
	hub.Broadcast(topic, ServerMessage{
		Type:    MsgTypeJobProgress,
		Payload: JobProgress{JobID: "shared-job", ProgressPct: 99},
	})

	// Both clients should receive the message.
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))

	var resp1, resp2 ServerMessage
	require.NoError(t, conn1.ReadJSON(&resp1))
	require.NoError(t, conn2.ReadJSON(&resp2))
	assert.Equal(t, MsgTypeJobProgress, resp1.Type)
	assert.Equal(t, MsgTypeJobProgress, resp2.Type)
}

func TestWebSocketCloseGraceful(t *testing.T) {
	hub := startTestHub(t)
	_, wsURL := wsTestServer(t, hub)

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)

	time.Sleep(100 * time.Millisecond)

	hub.mu.RLock()
	countBefore := len(hub.clients["ws-tenant"])
	hub.mu.RUnlock()
	assert.Equal(t, 1, countBefore)

	// Close the WebSocket connection gracefully.
	conn.WriteMessage(websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
	conn.Close()

	// Give the hub time to process the unregister.
	time.Sleep(200 * time.Millisecond)

	hub.mu.RLock()
	countAfter := len(hub.clients["ws-tenant"])
	hub.mu.RUnlock()
	assert.Equal(t, 0, countAfter, "client should be unregistered after close")
}

// ---------------------------------------------------------------------------
// totalClients test
// ---------------------------------------------------------------------------

func TestTotalClients(t *testing.T) {
	hub := startTestHub(t)

	c1 := newTestClient(hub, "t-a")
	c2 := newTestClient(hub, "t-a")
	c3 := newTestClient(hub, "t-b")
	hub.register <- c1
	hub.register <- c2
	hub.register <- c3
	time.Sleep(50 * time.Millisecond)

	total := hub.totalClients()
	assert.Equal(t, 3, total)

	hub.unregister <- c1
	time.Sleep(50 * time.Millisecond)

	total = hub.totalClients()
	assert.Equal(t, 2, total)
}

// ---------------------------------------------------------------------------
// NewClient registration test (via real hub channel)
// ---------------------------------------------------------------------------

func TestNewClientRegistersWithHub(t *testing.T) {
	hub := startTestHub(t)

	// We need a real websocket connection for NewClient. Use httptest.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := testUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}

		client := NewClient(hub, conn, "reg-tenant")
		assert.NotNil(t, client)
		assert.Equal(t, hub, client.hub)
		assert.Equal(t, "reg-tenant", client.tenantID)
		assert.NotNil(t, client.send)
		assert.NotNil(t, client.subscriptions)

		// Start pumps so the client lifecycle works.
		go client.ReadPump()
		go client.WritePump()
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	time.Sleep(100 * time.Millisecond)

	hub.mu.RLock()
	count := len(hub.clients["reg-tenant"])
	hub.mu.RUnlock()
	assert.Equal(t, 1, count, "NewClient should register the client with the hub")
}

// ---------------------------------------------------------------------------
// WritePump drain path: multiple queued messages sent as separate frames
// ---------------------------------------------------------------------------

func TestWebSocketWritePumpDrainsQueue(t *testing.T) {
	hub := startTestHub(t)
	_, wsURL := wsTestServer(t, hub)

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	time.Sleep(100 * time.Millisecond)

	// Subscribe to a topic.
	payload, _ := json.Marshal(SubscribeJobProgressPayload{JobID: "drain-job"})
	require.NoError(t, conn.WriteJSON(ClientMessage{
		Type:    MsgTypeSubscribeJobProgress,
		Payload: payload,
	}))

	time.Sleep(100 * time.Millisecond)

	// Broadcast multiple messages rapidly so the WritePump has to drain queued items.
	topic := jobProgressTopic("ws-tenant", "drain-job")
	for i := 0; i < 5; i++ {
		hub.Broadcast(topic, ServerMessage{
			Type:    MsgTypeJobProgress,
			Payload: JobProgress{JobID: "drain-job", ProgressPct: i * 20},
		})
	}

	// Read all 5 messages.
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	received := 0
	for received < 5 {
		var resp ServerMessage
		err := conn.ReadJSON(&resp)
		if err != nil {
			break
		}
		assert.Equal(t, MsgTypeJobProgress, resp.Type)
		received++
	}
	assert.Equal(t, 5, received, "should receive all 5 broadcast messages")
}

// ---------------------------------------------------------------------------
// handleSubscribeJobProgress: complete subscription fails (max subs reached)
// ---------------------------------------------------------------------------

func TestClientHandleSubscribeJobProgressCompleteSubFails(t *testing.T) {
	hub := startTestHub(t)
	client := newTestClient(hub, "tenant-1")
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	// Fill up subscriptions to maxSubscriptions - 1, so the progress
	// subscription succeeds but the complete subscription fails.
	for i := 0; i < maxSubscriptions-1; i++ {
		require.NoError(t, hub.subscribe(client, topicName(i)))
	}

	// Now handleSubscribeJobProgress will subscribe to progress (ok, uses slot 10)
	// and then try to subscribe to complete (fails, would be slot 11).
	payload, _ := json.Marshal(SubscribeJobProgressPayload{JobID: "edge-job"})
	raw, _ := json.Marshal(ClientMessage{
		Type:    MsgTypeSubscribeJobProgress,
		Payload: payload,
	})

	client.handleMessage(raw)

	// The progress subscription should succeed.
	expectedProgress := jobProgressTopic("tenant-1", "edge-job")
	client.subsMu.Lock()
	_, hasProgress := client.subscriptions[expectedProgress]
	client.subsMu.Unlock()
	assert.True(t, hasProgress, "progress subscription should succeed")

	// The complete subscription should have failed (non-fatal).
	expectedComplete := jobCompleteTopic("tenant-1", "edge-job")
	client.subsMu.Lock()
	_, hasComplete := client.subscriptions[expectedComplete]
	client.subsMu.Unlock()
	assert.False(t, hasComplete, "complete subscription should fail due to max limit")

	// No error message should be sent to the client (non-fatal failure).
	assert.Equal(t, 0, len(client.send), "no error should be sent for non-fatal complete sub failure")
}

// ---------------------------------------------------------------------------
// broadcastToTopic: final drop path (both send attempts fail)
// ---------------------------------------------------------------------------

func TestHubBroadcastDropsWhenClientTooSlow(t *testing.T) {
	hub := startTestHub(t)

	// Client with capacity 1.
	client := &Client{
		hub:           hub,
		tenantID:      "tenant-slow",
		send:          make(chan []byte, 1),
		subscriptions: make(map[string]struct{}),
		logger:        hub.logger.With("tenant", "tenant-slow"),
	}
	hub.register <- client
	time.Sleep(50 * time.Millisecond)

	topic := "slow-topic"
	require.NoError(t, hub.subscribe(client, topic))

	// Fill the buffer.
	client.send <- []byte(`{"type":"fill1"}`)

	// First broadcast: will drain the old message and insert new one.
	hub.Broadcast(topic, ServerMessage{Type: "msg1"})
	time.Sleep(50 * time.Millisecond)

	// The channel should have exactly 1 message (the new one replaced the old).
	assert.Equal(t, 1, len(client.send))

	// Refill: drain and add a new message.
	<-client.send
	client.send <- []byte(`{"type":"blocker"}`)

	// Now broadcast twice rapidly to try to trigger the "client too slow" path.
	// The first broadcast will try to drain and reinsert, the second may drop.
	hub.Broadcast(topic, ServerMessage{Type: "rapid1"})
	hub.Broadcast(topic, ServerMessage{Type: "rapid2"})
	time.Sleep(100 * time.Millisecond)

	// Should not panic and channel should not exceed capacity.
	assert.LessOrEqual(t, len(client.send), 1)
}
