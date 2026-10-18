package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record OutcomeRequestDto(
        @NotNull(message = "actual_g3 is required")
        @Min(value = 0, message = "actual_g3 must be between 0 and 20")
        @Max(value = 20, message = "actual_g3 must be between 0 and 20")
        @JsonProperty("actual_g3")
        Integer actualG3,

        @JsonProperty("source")
        String source,

        @JsonProperty("verification_status")
        String verificationStatus,

        @JsonProperty("notes")
        String notes
) {
    public String getEffectiveSource() {
        return (source != null && !source.isBlank()) ? source : "teacher_reported";
    }

    public String getEffectiveVerificationStatus() {
        return (verificationStatus != null && !verificationStatus.isBlank()) ? verificationStatus : "recorded";
    }
}
