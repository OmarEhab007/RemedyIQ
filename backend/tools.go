//go:build tools
// +build tools

// Package tools tracks tool and library dependencies that are needed
// but not yet directly imported in application code.
// This file ensures `go mod tidy` does not remove them.
package tools

import (
	_ "github.com/ClickHouse/clickhouse-go/v2"
	_ "github.com/aws/aws-sdk-go-v2"
	_ "github.com/aws/aws-sdk-go-v2/config"
	_ "github.com/aws/aws-sdk-go-v2/credentials"
	_ "github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	_ "github.com/aws/aws-sdk-go-v2/service/s3"
	_ "github.com/blevesearch/bleve/v2"
	_ "github.com/google/uuid"
	_ "github.com/gorilla/mux"
	_ "github.com/gorilla/websocket"
	_ "github.com/jackc/pgx/v5"
	_ "github.com/joho/godotenv"
	_ "github.com/nats-io/nats.go"
	_ "github.com/redis/go-redis/v9"
	_ "github.com/stretchr/testify"
)
