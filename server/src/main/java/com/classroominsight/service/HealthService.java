package com.classroominsight.service;

import com.classroominsight.dto.AppHealthResponseDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class HealthService {

    private static final Logger logger = LoggerFactory.getLogger(HealthService.class);

    private final DataSource dataSource;
    private final MlServiceClient mlServiceClient;
    private final String mlServiceUrl;

    public HealthService(DataSource dataSource,
                         MlServiceClient mlServiceClient,
                         @Value("${classroominsight.ml.service-url:http://localhost:8000}") String mlServiceUrl) {
        this.dataSource = dataSource;
        this.mlServiceClient = mlServiceClient;
        this.mlServiceUrl = mlServiceUrl;
    }

    public HealthResult checkHealth() {
        boolean dbHealthy = false;
        Map<String, Object> dbDetails = new HashMap<>();
        dbDetails.put("database", "H2");

        try (Connection conn = dataSource.getConnection()) {
            dbHealthy = conn.isValid(2);
            dbDetails.put("file", "data/h2/classroom_insight");
        } catch (Exception ex) {
            logger.warn("Database health check failed: {}", ex.getMessage());
            dbDetails.put("error", ex.getMessage());
        }

        Map<String, Object> mlHealth = mlServiceClient.getHealth();
        String mlStatus = (String) mlHealth.getOrDefault("status", "DOWN");
        Map<String, Object> mlDetails = new HashMap<>();
        mlDetails.put("url", mlServiceUrl + "/internal/health");
        if (mlHealth.containsKey("models_loaded_count")) {
            mlDetails.put("models_loaded", mlHealth.get("models_loaded_count"));
        } else if (mlHealth.containsKey("models_loaded")) {
            mlDetails.put("models_loaded", mlHealth.get("models_loaded"));
        }

        String overallStatus;
        int httpStatusCode;

        if (!dbHealthy) {
            overallStatus = "DOWN";
            httpStatusCode = 503;
        } else if ("UP".equalsIgnoreCase(mlStatus)) {
            overallStatus = "UP";
            httpStatusCode = 200;
        } else {
            // DB is up, but ML service is down or degraded
            overallStatus = "DEGRADED";
            httpStatusCode = 200;
        }

        Map<String, AppHealthResponseDto.ComponentHealthDto> components = new HashMap<>();
        components.put("database", new AppHealthResponseDto.ComponentHealthDto(dbHealthy ? "UP" : "DOWN", dbDetails));
        components.put("ml_service", new AppHealthResponseDto.ComponentHealthDto(mlStatus, mlDetails));

        AppHealthResponseDto body = new AppHealthResponseDto(
                overallStatus,
                "1.0.0",
                Instant.now().toString(),
                components
        );

        return new HealthResult(overallStatus, httpStatusCode, body);
    }

    public record HealthResult(String status, int httpStatusCode, AppHealthResponseDto responseBody) {}
}
