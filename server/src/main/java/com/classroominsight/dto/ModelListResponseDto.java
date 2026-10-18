package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record ModelListResponseDto(
        @JsonProperty("goal")
        String goal,

        @JsonProperty("models")
        List<ModelInfoDto> models
) {}
