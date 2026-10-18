package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

public record AppHealthResponseDto(
        @JsonProperty("status")
        String status,

        @JsonProperty("version")
        String version,

        @JsonProperty("timestamp")
        String timestamp,

        @JsonProperty("components")
        Map<String, ComponentHealthDto> components
) {
    public record ComponentHealthDto(
            @JsonProperty("status")
            String status,

            @JsonProperty("details")
            Map<String, Object> details
    ) {}
}
