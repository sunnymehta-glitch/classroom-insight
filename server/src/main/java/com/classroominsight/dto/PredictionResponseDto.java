package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.UUID;

public record PredictionResponseDto(
        @JsonProperty("prediction_id")
        UUID predictionId,

        @JsonProperty("goal")
        String goal,

        @JsonProperty("mode")
        String mode,

        @JsonProperty("status")
        String status,

        @JsonProperty("student_reference")
        String studentReference,

        @JsonProperty("features")
        FeaturesDto features,

        @JsonProperty("results")
        List<ModelPredictionResultDto> results,

        @JsonProperty("created_at")
        String createdAt,

        @JsonProperty("schema_version")
        String schemaVersion,

        @JsonProperty("verified_outcome")
        @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
        OutcomeResponseDto verifiedOutcome
) {
    public PredictionResponseDto(
            UUID predictionId,
            String goal,
            String mode,
            String status,
            String studentReference,
            FeaturesDto features,
            List<ModelPredictionResultDto> results,
            String createdAt,
            String schemaVersion
    ) {
        this(predictionId, goal, mode, status, studentReference, features, results, createdAt, schemaVersion, null);
    }
}
