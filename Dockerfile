# Classroom Insight — Unified Production Deployment Dockerfile (Render Web Service)
# Runs Spring Boot (public on Render $PORT) + Internal FastAPI ML Service (loopback only on 127.0.0.1:8000)

# ==============================================================================
# Stage 1: Build Spring Boot JAR
# ==============================================================================
FROM maven:3.9-eclipse-temurin-25 AS build-server
WORKDIR /build

# Cache maven dependencies
COPY server/pom.xml .
RUN mvn dependency:go-offline -B || true

# Compile and package application
COPY server/src ./src
RUN mvn clean package -DskipTests

# ==============================================================================
# Stage 2: Runtime Image (Python 3.14 + Temurin 25 JRE)
# ==============================================================================
FROM eclipse-temurin:25-jre AS jre-source

FROM python:3.14-slim AS runtime

# Install system utilities (curl, procps for process health and signal management)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    procps \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy Eclipse Temurin 25 JRE from jre-source
ENV JAVA_HOME=/opt/java/openjdk
COPY --from=jre-source $JAVA_HOME $JAVA_HOME
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Verify runtimes
RUN java -version && python --version

WORKDIR /app

# Install ML service Python dependencies
COPY ml-service/requirements.txt /app/ml-service/
RUN pip install --no-cache-dir -r /app/ml-service/requirements.txt

# Copy ML service application and canonical model artifacts
COPY ml-service/app/ /app/ml-service/app/
COPY ml-service/artifacts/ /app/ml-service/artifacts/

# Copy compiled Spring Boot server JAR
COPY --from=build-server /build/target/classroom-insight-server-1.0.0.jar /app/server.jar

# Copy and configure startup script
COPY scripts/start-render.sh /app/start-render.sh
RUN sed -i 's/\r$//' /app/start-render.sh && chmod +x /app/start-render.sh && mkdir -p /app/data/h2

# Environment variables
# - Render assigns $PORT dynamically (default 10000)
# - FastAPI binds strictly to 127.0.0.1:8000
# - Spring Boot connects to internal ML service at http://127.0.0.1:8000
# - Java heap memory is tuned for Render Free 512MB RAM tier
ENV PORT=10000 \
    PYTHONUNBUFFERED=1 \
    ARTIFACTS_DIR=/app/ml-service/artifacts \
    REPORTS_DIR=/app/ml-service/artifacts \
    ML_SERVICE_URL=http://127.0.0.1:8000 \
    ML_SERVICE_TIMEOUT_MS=5000 \
    SPRING_PROFILES_ACTIVE=prod \
    JAVA_OPTS="-Xms64m -Xmx192m -XX:+UseSerialGC -XX:MaxMetaspaceSize=112m -XX:ReservedCodeCacheSize=48m -Xss512k -XX:+ExitOnOutOfMemoryError"

# Only the public application port (Render PORT) is exposed
EXPOSE 10000

# Docker healthcheck hits Spring Boot public health endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=35s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT}/api/health || exit 1

ENTRYPOINT ["/bin/bash", "/app/start-render.sh"]
