package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;

public record ErrorResponseDto(
        @JsonProperty("error") ErrorBody error,
        @JsonProperty("timestamp") String timestamp
) {
    public static ErrorResponseDto of(String code, String message, List<ErrorDetail> details, String requestId) {
        return new ErrorResponseDto(
                new ErrorBody(code, message, details != null ? details : List.of(), requestId),
                Instant.now().toString()
        );
    }

    public record ErrorBody(
            @JsonProperty("code") String code,
            @JsonProperty("message") String message,
            @JsonProperty("details") List<ErrorDetail> details,
            @JsonProperty("request_id") String requestId
    ) {}

    public record ErrorDetail(
            @JsonProperty("field") String field,
            @JsonProperty("issue") String issue
    ) {}
}
