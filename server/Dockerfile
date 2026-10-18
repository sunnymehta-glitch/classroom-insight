# Classroom Insight — Spring Boot Backend Dockerfile
# Stage 1: Build application JAR
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -B || true
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime image
FROM eclipse-temurin:25-jre
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /build/target/classroom-insight-server-1.0.0.jar app.jar

ENV SERVER_PORT=8080 \
    ML_SERVICE_URL=http://ml-service:8000 \
    ML_SERVICE_TIMEOUT_MS=5000 \
    SPRING_DATASOURCE_URL=jdbc:h2:file:/app/data/h2/classroom_insight;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE \
    SPRING_DATASOURCE_USERNAME=sa \
    SPRING_DATASOURCE_PASSWORD=

VOLUME ["/app/data/h2"]

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
