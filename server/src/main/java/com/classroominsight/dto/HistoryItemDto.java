package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.UUID;

public record HistoryItemDto(
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

        @JsonProperty("models_used")
        List<String> modelsUsed,

        @JsonProperty("primary_result")
        String primaryResult,

        @JsonProperty("has_recorded_outcome")
        boolean hasRecordedOutcome,

        @JsonProperty("created_at")
        String createdAt
) {}
