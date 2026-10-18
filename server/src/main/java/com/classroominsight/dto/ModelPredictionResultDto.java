package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record ModelPredictionResultDto(
        @JsonProperty("model_id")
        String modelId,

        @JsonProperty("model_version")
        String modelVersion,

        @JsonProperty("status")
        String status,

        @JsonProperty("predicted_grade")
        Double predictedGrade,

        @JsonProperty("predicted_class")
        String predictedClass,

        @JsonProperty("error_message")
        String errorMessage
) {}
