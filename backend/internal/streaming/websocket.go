package streaming

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer at this interval. Must be less than pongWait.
	pingPeriod = 30 * time.Second

	// Maximum message size allowed from peer (16 KB).
	maxMessageSize = 16 * 1024

	// Maximum messages buffered per client before the write pump drops the
	// connection.
	sendBufferSize = 1000

	// Maximum concurrent subscriptions a single client may hold.
	maxSubscriptions = 10
)

// ---------------------------------------------------------------------------
// Client-to-server message types
// ---------------------------------------------------------------------------

const (
	MsgTypeSubscribeJobProgress   = "subscribe_job_progress"
	MsgTypeUnsubscribeJobProgress = "unsubscribe_job_progress"
	MsgTypeSubscribeLiveTail      = "subscribe_live_tail"
	MsgTypeUnsubscribeLiveTail    = "unsubscribe_live_tail"
	MsgTypePing                   = "ping"
)

// ---------------------------------------------------------------------------
// Server-to-client message types
// ---------------------------------------------------------------------------

const (
	MsgTypeJobProgress   = "job_progress"
	MsgTypeJobComplete   = "job_complete"
	MsgTypeLiveTailEntry = "live_tail_entry"
	MsgTypeError         = "error"
	MsgTypePong          = "pong"
)

// ---------------------------------------------------------------------------
// Wire messages
// ---------------------------------------------------------------------------

// ClientMessage is the envelope for all client-to-server WebSocket messages.
type ClientMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// ServerMessage is the envelope for all server-to-client WebSocket messages.
type ServerMessage struct {
	Type    string `json:"type"`
	Payload any    `json:"payload,omitempty"`
}

// SubscribeJobProgressPayload is sent by the client to subscribe to job progress.
type SubscribeJobProgressPayload struct {
	JobID string `json:"job_id"`
}

// SubscribeLiveTailPayload is sent by the client to subscribe to live tail.
type SubscribeLiveTailPayload struct {
	LogType string `json:"log_type"`
}

// ErrorPayload is sent by the server when an error occurs.
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

// Hub maintains the set of active WebSocket clients and broadcasts messages
// to clients that have subscribed to specific topics.
type Hub struct {
	// Registered clients keyed by tenant ID, then by client pointer.
	clients map[string]map[*Client]struct{}

	// Topic subscriptions: topic -> set of clients.
	topics map[string]map[*Client]struct{}

	register   chan *Client
	unregister chan *Client
	broadcast  chan topicMessage

	mu     sync.RWMutex
	logger *slog.Logger
}

// topicMessage is an internal struct for broadcasting a message to a topic.
type topicMessage struct {
	topic   string
	message ServerMessage
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]struct{}),
		topics:     make(map[string]map[*Client]struct{}),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan topicMessage, 256),
		logger:     slog.Default().With("component", "ws-hub"),
	}
}

// Run starts the hub event loop. It must be called in a dedicated goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.addClient(client)

		case client := <-h.unregister:
			h.removeClient(client)

		case tm := <-h.broadcast:
			h.broadcastToTopic(tm)
		}
	}
}

func (h *Hub) addClient(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	tenantClients, ok := h.clients[c.tenantID]
	if !ok {
		tenantClients = make(map[*Client]struct{})
		h.clients[c.tenantID] = tenantClients
	}
	tenantClients[c] = struct{}{}

	h.logger.Info("client registered", "tenant", c.tenantID, "total_clients", h.totalClientsLocked())
}

func (h *Hub) removeClient(c *Client) {
	h.mu.Lock()

	// Remove from tenant map.
	if tenantClients, ok := h.clients[c.tenantID]; ok {
		delete(tenantClients, c)
		if len(tenantClients) == 0 {
			delete(h.clients, c.tenantID)
		}
	}

	h.mu.Unlock()

	// Acquire the client's subscription mutex to safely snapshot and clear subscriptions.
	c.subsMu.Lock()
	subs := c.subscriptions
	c.subscriptions = nil
	c.subsMu.Unlock()

	// Remove from all topic subscriptions.
	h.mu.Lock()
	for topic := range subs {
		if topicClients, ok := h.topics[topic]; ok {
			delete(topicClients, c)
			if len(topicClients) == 0 {
				delete(h.topics, topic)
			}
		}
	}
	h.mu.Unlock()

	close(c.send)

	h.logger.Info("client unregistered", "tenant", c.tenantID, "total_clients", h.totalClientsLocked())
}

func (h *Hub) totalClientsLocked() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	n := 0
	for _, m := range h.clients {
		n += len(m)
	}
	return n
}

func (h *Hub) broadcastToTopic(tm topicMessage) {
	h.mu.RLock()
	subscribers, ok := h.topics[tm.topic]
	if !ok || len(subscribers) == 0 {
		h.mu.RUnlock()
		return
	}

	// Copy subscriber set under read lock to avoid holding it during writes.
	targets := make([]*Client, 0, len(subscribers))
	for c := range subscribers {
		targets = append(targets, c)
	}
	h.mu.RUnlock()

	data, err := json.Marshal(tm.message)
	if err != nil {
		h.logger.Error("marshal broadcast message", "error", err, "topic", tm.topic)
		return
	}

	for _, c := range targets {
		select {
		case c.send <- data:
		default:
			// Buffer full -- drop oldest by draining one and retrying once.
			select {
			case <-c.send:
				h.logger.Warn("dropped oldest message due to backpressure",
					"tenant", c.tenantID, "topic", tm.topic)
			default:
			}
			select {
			case c.send <- data:
			default:
				h.logger.Warn("message dropped, client too slow",
					"tenant", c.tenantID, "topic", tm.topic)
			}
		}
	}
}

// Broadcast sends a message to all clients subscribed to the given topic.
func (h *Hub) Broadcast(topic string, msg ServerMessage) {
	h.broadcast <- topicMessage{topic: topic, message: msg}
}

// subscribe adds a client to a topic. Returns an error if the client has
// reached the maximum number of concurrent subscriptions.
//
// Lock ordering: hub mutex is always acquired before client subsMu to
// prevent deadlocks with removeClient.
func (h *Hub) subscribe(c *Client, topic string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	c.subsMu.Lock()
	defer c.subsMu.Unlock()

	if len(c.subscriptions) >= maxSubscriptions {
		return fmt.Errorf("maximum subscriptions (%d) reached", maxSubscriptions)
	}
	if c.subscriptions == nil {
		c.subscriptions = make(map[string]struct{})
	}
	c.subscriptions[topic] = struct{}{}

	if h.topics[topic] == nil {
		h.topics[topic] = make(map[*Client]struct{})
	}
	h.topics[topic][c] = struct{}{}

	h.logger.Debug("client subscribed", "tenant", c.tenantID, "topic", topic)
	return nil
}

// unsubscribe removes a client from a topic.
//
// Lock ordering: hub mutex is always acquired before client subsMu.
func (h *Hub) unsubscribe(c *Client, topic string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	c.subsMu.Lock()
	delete(c.subscriptions, topic)
	c.subsMu.Unlock()

	if topicClients, ok := h.topics[topic]; ok {
		delete(topicClients, c)
		if len(topicClients) == 0 {
			delete(h.topics, topic)
		}
	}

	h.logger.Debug("client unsubscribed", "tenant", c.tenantID, "topic", topic)
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

// Client represents a single WebSocket connection bound to a tenant.
type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	tenantID string

	// Buffered channel of outbound messages (serialized JSON bytes).
	send chan []byte

	// Active topic subscriptions for this client.
	subscriptions map[string]struct{}
	subsMu        sync.Mutex

	logger *slog.Logger
}

// NewClient creates a new WebSocket client, registers it with the hub, and
// returns it. The caller must start ReadPump and WritePump in separate
// goroutines.
func NewClient(hub *Hub, conn *websocket.Conn, tenantID string) *Client {
	c := &Client{
		hub:           hub,
		conn:          conn,
		tenantID:      tenantID,
		send:          make(chan []byte, sendBufferSize),
		subscriptions: make(map[string]struct{}),
		logger:        slog.Default().With("component", "ws-client", "tenant", tenantID),
	}
	hub.register <- c
	return c
}

// ReadPump reads messages from the WebSocket connection and dispatches them.
// It must run in its own goroutine. When it returns, the client is
// unregistered and the connection is closed.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				c.logger.Warn("unexpected close", "error", err)
			}
			return
		}
		c.handleMessage(raw)
	}
}

// WritePump writes messages from the send channel to the WebSocket
// connection. It also sends periodic ping frames. It must run in its own
// goroutine.
//
// Each queued message is sent as a separate WebSocket text frame so that
// the client can JSON.parse each frame individually.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel.
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Write the first message as its own frame.
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

			// Drain queued messages, sending each as a separate frame.
			n := len(c.send)
			for i := 0; i < n; i++ {
				if err := c.conn.WriteMessage(websocket.TextMessage, <-c.send); err != nil {
					return
				}
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage parses an incoming client message and dispatches it to the
// appropriate handler.
func (c *Client) handleMessage(raw []byte) {
	var msg ClientMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.sendError("INVALID_MESSAGE", "failed to parse message")
		return
	}

	switch msg.Type {
	case MsgTypePing:
		c.sendJSON(ServerMessage{Type: MsgTypePong})

	case MsgTypeSubscribeJobProgress:
		c.handleSubscribeJobProgress(msg.Payload)

	case MsgTypeUnsubscribeJobProgress:
		c.handleUnsubscribeJobProgress(msg.Payload)

	case MsgTypeSubscribeLiveTail:
		c.handleSubscribeLiveTail(msg.Payload)

	case MsgTypeUnsubscribeLiveTail:
		c.handleUnsubscribeLiveTail(msg.Payload)

	default:
		c.sendError("UNKNOWN_TYPE", fmt.Sprintf("unknown message type: %s", msg.Type))
	}
}

func (c *Client) handleSubscribeJobProgress(payload json.RawMessage) {
	var p SubscribeJobProgressPayload
	if err := json.Unmarshal(payload, &p); err != nil || p.JobID == "" {
		c.sendError("INVALID_PAYLOAD", "job_id is required for subscribe_job_progress")
		return
	}

	topic := jobProgressTopic(c.tenantID, p.JobID)
	if err := c.hub.subscribe(c, topic); err != nil {
		c.sendError("SUBSCRIBE_FAILED", err.Error())
		return
	}

	// Also subscribe to job complete for this job.
	completeTopic := jobCompleteTopic(c.tenantID, p.JobID)
	if err := c.hub.subscribe(c, completeTopic); err != nil {
		// Non-fatal: progress subscription already succeeded.
		c.logger.Warn("failed to subscribe to job complete", "error", err, "job_id", p.JobID)
	}
}

func (c *Client) handleUnsubscribeJobProgress(payload json.RawMessage) {
	var p SubscribeJobProgressPayload
	if err := json.Unmarshal(payload, &p); err != nil || p.JobID == "" {
		c.sendError("INVALID_PAYLOAD", "job_id is required for unsubscribe_job_progress")
		return
	}

	c.hub.unsubscribe(c, jobProgressTopic(c.tenantID, p.JobID))
	c.hub.unsubscribe(c, jobCompleteTopic(c.tenantID, p.JobID))
}

func (c *Client) handleSubscribeLiveTail(payload json.RawMessage) {
	var p SubscribeLiveTailPayload
	if err := json.Unmarshal(payload, &p); err != nil || p.LogType == "" {
		c.sendError("INVALID_PAYLOAD", "log_type is required for subscribe_live_tail")
		return
	}

	topic := liveTailTopic(c.tenantID, p.LogType)
	if err := c.hub.subscribe(c, topic); err != nil {
		c.sendError("SUBSCRIBE_FAILED", err.Error())
		return
	}
}

func (c *Client) handleUnsubscribeLiveTail(payload json.RawMessage) {
	var p SubscribeLiveTailPayload
	if err := json.Unmarshal(payload, &p); err != nil || p.LogType == "" {
		c.sendError("INVALID_PAYLOAD", "log_type is required for unsubscribe_live_tail")
		return
	}

	c.hub.unsubscribe(c, liveTailTopic(c.tenantID, p.LogType))
}

// sendJSON marshals a ServerMessage and enqueues it for writing.
func (c *Client) sendJSON(msg ServerMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		c.logger.Error("marshal server message", "error", err)
		return
	}

	select {
	case c.send <- data:
	default:
		c.logger.Warn("send buffer full, dropping message", "type", msg.Type)
	}
}

// sendError sends an error message to the client.
func (c *Client) sendError(code, message string) {
	c.sendJSON(ServerMessage{
		Type: MsgTypeError,
		Payload: ErrorPayload{
			Code:    code,
			Message: message,
		},
	})
}

// ---------------------------------------------------------------------------
// Topic naming helpers
// ---------------------------------------------------------------------------

// jobProgressTopic returns the internal hub topic for job progress updates.
func jobProgressTopic(tenantID, jobID string) string {
	return fmt.Sprintf("job_progress.%s.%s", tenantID, jobID)
}

// jobCompleteTopic returns the internal hub topic for job completion.
func jobCompleteTopic(tenantID, jobID string) string {
	return fmt.Sprintf("job_complete.%s.%s", tenantID, jobID)
}

// liveTailTopic returns the internal hub topic for live tail entries.
func liveTailTopic(tenantID, logType string) string {
	return fmt.Sprintf("live_tail.%s.%s", tenantID, logType)
}
