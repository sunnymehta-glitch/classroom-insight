package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

public record OutcomeResponseDto(
        @JsonProperty("outcome_id")
        UUID outcomeId,

        @JsonProperty("prediction_id")
        UUID predictionId,

        @JsonProperty("actual_g3")
        Integer actualG3,

        @JsonProperty("actual_pass_status")
        String actualPassStatus,

        @JsonProperty("source")
        String source,

        @JsonProperty("verification_status")
        String verificationStatus,

        @JsonProperty("notes")
        String notes,

        @JsonProperty("recorded_at")
        String recordedAt
) {}
