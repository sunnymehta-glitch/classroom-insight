package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = false)
public record PredictionRequestDto(
        @NotBlank(message = "goal is required")
        @Pattern(regexp = "^(regression|classification)$", message = "goal must be 'regression' or 'classification'")
        @JsonProperty("goal")
        String goal,

        @NotBlank(message = "mode is required")
        @Pattern(regexp = "^(single|compare)$", message = "mode must be 'single' or 'compare'")
        @JsonProperty("mode")
        String mode,

        @JsonProperty("model_id")
        String modelId,

        @JsonProperty("model_ids")
        List<String> modelIds,

        @Pattern(regexp = "^[A-Za-z0-9_-]{1,32}$", message = "student_reference must be 1-32 alphanumeric, dash, or underscore characters")
        @JsonProperty("student_reference")
        String studentReference,

        @NotNull(message = "features object is required")
        @Valid
        @JsonProperty("features")
        FeaturesDto features
) {
    public List<String> getEffectiveModelIds() {
        if ("single".equalsIgnoreCase(mode)) {
            if (modelId != null && !modelId.isBlank()) {
                return List.of(modelId);
            }
            if (modelIds != null && !modelIds.isEmpty()) {
                return List.of(modelIds.get(0));
            }
            return List.of();
        } else {
            return modelIds != null ? modelIds : List.of();
        }
    }
}
