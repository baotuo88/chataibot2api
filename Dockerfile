FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /chataibot2api .

FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /chataibot2api /usr/local/bin/chataibot2api

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/chataibot2api"]
