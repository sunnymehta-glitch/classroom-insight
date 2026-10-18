package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record PerformanceResponseDto(
        @JsonProperty("goal")
        String goal,

        @JsonProperty("dataset")
        String dataset,

        @JsonProperty("evaluation_strategy")
        String evaluationStrategy,

        @JsonProperty("test_sample_count")
        Integer testSampleCount,

        @JsonProperty("generated_at")
        String generatedAt,

        @JsonProperty("models")
        List<ModelPerformanceDto> models
) {
    public record ModelPerformanceDto(
            @JsonProperty("model_id")
            String modelId,

            @JsonProperty("name")
            String name,

            @JsonProperty("version")
            String version,

            @JsonProperty("metrics")
            Map<String, Object> metrics,

            @JsonProperty("cv_metrics")
            Map<String, Object> cvMetrics,

            @JsonProperty("status")
            String status
    ) {}
}
