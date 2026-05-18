FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /build
COPY go.mod go.sum* ./
RUN go mod download || true
COPY . .
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w -X main.version=${VERSION}" -o /app/security ./cmd/security 2>/dev/null ||     CGO_ENABLED=0 GOOS=linux go build -o /app/security ./cmd/security

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/security /security
EXPOSE 8080
ENTRYPOINT ["/security"]
