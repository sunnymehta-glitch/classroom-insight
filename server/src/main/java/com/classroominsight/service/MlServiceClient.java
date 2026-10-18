package com.classroominsight.service;

import com.classroominsight.dto.ModelListResponseDto;
import com.classroominsight.dto.ModelPredictionResultDto;
import com.classroominsight.dto.PerformanceResponseDto;
import com.classroominsight.dto.PredictionRequestDto;
import com.classroominsight.exception.ApiException;
import com.classroominsight.exception.UpstreamMlServiceException;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MlServiceClient {

    private static final Logger logger = LoggerFactory.getLogger(MlServiceClient.class);

    private final RestTemplate restTemplate;
    private final String serviceUrl;
    private final ObjectMapper objectMapper;

    public MlServiceClient(RestTemplate restTemplate,
                           @Value("${classroominsight.ml.service-url:http://localhost:8000}") String serviceUrl,
                           ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.serviceUrl = serviceUrl.endsWith("/") ? serviceUrl.substring(0, serviceUrl.length() - 1) : serviceUrl;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> getHealth() {
        String url = serviceUrl + "/internal/health";
        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<>() {}
            );
            return response.getBody() != null ? response.getBody() : Map.of("status", "UP");
        } catch (HttpStatusCodeException ex) {
            logger.warn("ML Service health returned HTTP {}", ex.getStatusCode());
            return Map.of("status", "DOWN", "error", ex.getStatusCode().toString());
        } catch (Exception ex) {
            logger.warn("ML Service health check failed: {}", ex.getMessage());
            return Map.of("status", "DOWN", "error", ex.getMessage());
        }
    }

    public ModelListResponseDto listModels(String goal) {
        String url = serviceUrl + "/internal/models?goal=" + goal;
        try {
            ResponseEntity<ModelListResponseDto> response = restTemplate.getForEntity(url, ModelListResponseDto.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            handleHttpException(ex);
            throw UpstreamMlServiceException.badGateway("Failed to list models from upstream ML service.");
        } catch (ResourceAccessException ex) {
            handleResourceAccessException(ex, "listing models");
            throw UpstreamMlServiceException.unavailable("Upstream ML service is unavailable.");
        }
    }

    public PerformanceResponseDto getPerformance(String goal) {
        String url = serviceUrl + "/internal/models/performance?goal=" + goal;
        try {
            ResponseEntity<PerformanceResponseDto> response = restTemplate.getForEntity(url, PerformanceResponseDto.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            handleHttpException(ex);
            throw UpstreamMlServiceException.badGateway("Failed to retrieve model performance from upstream ML service.");
        } catch (ResourceAccessException ex) {
            handleResourceAccessException(ex, "retrieving performance report");
            throw UpstreamMlServiceException.unavailable("Upstream ML service is unavailable.");
        }
    }

    public InternalPredictionResponse predict(PredictionRequestDto request) {
        String url = serviceUrl + "/internal/predictions";

        Map<String, Object> payload = new HashMap<>();
        payload.put("goal", request.goal());
        payload.put("mode", request.mode());
        payload.put("model_id", request.modelId());
        payload.put("model_ids", request.getEffectiveModelIds());
        payload.put("features", request.features());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<InternalPredictionResponse> response = restTemplate.postForEntity(
                    url,
                    entity,
                    InternalPredictionResponse.class
            );
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            handleHttpException(ex);
            throw UpstreamMlServiceException.badGateway("Upstream ML service returned an unhandled error.");
        } catch (ResourceAccessException ex) {
            handleResourceAccessException(ex, "prediction inference");
            throw UpstreamMlServiceException.unavailable("Upstream ML service is unreachable.");
        }
    }

    private void handleResourceAccessException(ResourceAccessException ex, String operation) {
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        Throwable cause = ex.getCause();
        String causeName = cause != null ? cause.getClass().getName().toLowerCase() : "";
        String causeMsg = cause != null && cause.getMessage() != null ? cause.getMessage().toLowerCase() : "";

        boolean isConnectFailure = msg.contains("connect timed out")
                || msg.contains("connection timed out")
                || msg.contains("connect timed")
                || causeMsg.contains("connect timed out")
                || causeMsg.contains("connection timed out")
                || causeMsg.contains("connect timed")
                || causeMsg.contains("connection refused")
                || msg.contains("connection refused")
                || causeName.contains("connecttimeout")
                || cause instanceof java.net.ConnectException
                || cause instanceof java.net.UnknownHostException
                || cause instanceof java.net.NoRouteToHostException;

        boolean isReadTimeout = !isConnectFailure && (
                msg.contains("read timed out")
                || causeMsg.contains("read timed out")
                || msg.contains("request cancelled")
                || causeMsg.contains("request cancelled")
                || msg.contains("socket read")
                || causeMsg.contains("socket read")
                || (cause instanceof java.net.SocketTimeoutException)
                || causeName.contains("sockettimeout")
                || (msg.contains("timed out") && !msg.contains("connect"))
                || (causeMsg.contains("timed out") && !causeMsg.contains("connect"))
        );

        if (isReadTimeout) {
            logger.error("Upstream ML service timed out during {}: {}", operation, ex.getMessage());
            throw UpstreamMlServiceException.timeout("Upstream ML service timed out.");
        }
        logger.error("Upstream ML service connection refused or unreachable during {}: {}", operation, ex.getMessage());
        throw UpstreamMlServiceException.unavailable("Upstream ML service is unreachable.");
    }

    private void handleHttpException(HttpStatusCodeException ex) {
        String responseBody = ex.getResponseBodyAsString();
        logger.warn("Upstream ML service returned HTTP {}: {}", ex.getStatusCode(), responseBody);

        String message = "Upstream ML service request failed.";
        String errorCode = "UPSTREAM_ERROR";

        try {
            JsonNode root = objectMapper.readTree(responseBody);
            if (root.has("error")) {
                JsonNode err = root.get("error");
                if (err.has("message")) {
                    message = err.get("message").asText();
                }
                if (err.has("code")) {
                    errorCode = err.get("code").asText();
                }
            } else if (root.has("detail")) {
                message = root.get("detail").asText();
            }
        } catch (Exception ignored) {}

        if (ex.getStatusCode() == HttpStatus.BAD_REQUEST) {
            throw new ApiException(HttpStatus.BAD_REQUEST, errorCode, message);
        } else if (ex.getStatusCode() == HttpStatus.NOT_FOUND) {
            throw new ApiException(HttpStatus.NOT_FOUND, errorCode, message);
        } else if (ex.getStatusCode() == HttpStatus.BAD_GATEWAY) {
            throw UpstreamMlServiceException.badGateway(message);
        } else if (ex.getStatusCode() == HttpStatus.SERVICE_UNAVAILABLE) {
            throw UpstreamMlServiceException.unavailable(message);
        }
    }

    public record InternalPredictionResponse(
            @JsonProperty("goal") String goal,
            @JsonProperty("mode") String mode,
            @JsonProperty("status") String status,
            @JsonProperty("results") List<ModelPredictionResultDto> results
    ) {}
}
