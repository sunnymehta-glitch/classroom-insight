#!/usr/bin/env bash
set -e

# Render assigns PORT dynamically (defaulting to 10000 on Render free tier)
export PORT="${PORT:-10000}"
export SERVER_PORT="${PORT}"

# Spring Boot connects to FastAPI internal ML service on loopback only
export ML_SERVICE_URL="http://127.0.0.1:8000"
export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-prod}"

echo "=========================================================="
echo " Starting Classroom Insight Production Service (Render)"
echo " Render Public Port: ${PORT}"
echo " Active Profile:     ${SPRING_PROFILES_ACTIVE}"
echo " Internal ML URL:    ${ML_SERVICE_URL}"
echo "=========================================================="

# Cleanup handler for graceful shutdown
cleanup() {
  echo "Shutting down processes..."
  if [ -n "$FASTAPI_PID" ]; then
    kill -TERM "$FASTAPI_PID" 2>/dev/null || true
  fi
  if [ -n "$JAVA_PID" ]; then
    kill -TERM "$JAVA_PID" 2>/dev/null || true
  fi
}
trap cleanup SIGTERM SIGINT EXIT

# Memory & Thread Optimization for Constrained Container Environments
export OPENBLAS_NUM_THREADS=1
export OMP_NUM_THREADS=1
export MKL_NUM_THREADS=1
export NUMEXPR_NUM_THREADS=1
export VECLIB_MAXIMUM_THREADS=1
export MALLOC_ARENA_MAX=2

# 1. Start FastAPI ML Service strictly on 127.0.0.1:8000
echo "[1/3] Launching internal ML service on loopback 127.0.0.1:8000..."
cd /app/ml-service
PORT=8000 uvicorn app.main:app --host 127.0.0.1 --port 8000 &
FASTAPI_PID=$!

# 2. Wait for FastAPI to become healthy before starting Spring Boot
echo "[2/3] Waiting for FastAPI internal health check to succeed..."
MAX_ATTEMPTS=30
ATTEMPT=0
until curl -s http://127.0.0.1:8000/internal/health | grep -q '"status":"UP"'; do
  if ! kill -0 "$FASTAPI_PID" 2>/dev/null; then
    echo "FATAL: FastAPI process terminated unexpectedly during startup."
    exit 1
  fi
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "FATAL: FastAPI did not become ready within ${MAX_ATTEMPTS} seconds."
    exit 1
  fi
  sleep 1
done
echo "ML service is UP and healthy on 127.0.0.1:8000."

# 3. Start Spring Boot on Render public PORT
echo "[3/3] Starting Spring Boot public service on port ${PORT}..."
cd /app
JAVA_HEAP_OPTS="${JAVA_OPTS:--Xms64m -Xmx192m -XX:+UseSerialGC -XX:MaxMetaspaceSize=112m -XX:ReservedCodeCacheSize=48m -Xss512k -XX:+ExitOnOutOfMemoryError}"

java $JAVA_HEAP_OPTS \
  -Dserver.port="${SERVER_PORT}" \
  -Dspring.profiles.active="${SPRING_PROFILES_ACTIVE}" \
  -jar /app/server.jar &
JAVA_PID=$!

# Wait for either process to terminate; if either exits, shut down cleanly
wait -n "$FASTAPI_PID" "$JAVA_PID"
EXIT_STATUS=$?
echo "A service process terminated with exit code ${EXIT_STATUS}. Exiting container."
exit $EXIT_STATUS
