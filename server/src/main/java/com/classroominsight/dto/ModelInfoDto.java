package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ModelInfoDto(
        @JsonProperty("model_id")
        String modelId,

        @JsonProperty("name")
        String name,

        @JsonProperty("family")
        String family,

        @JsonProperty("version")
        String version,

        @JsonProperty("status")
        String status,

        @JsonProperty("description")
        String description,

        @JsonProperty("selected_primary_candidate")
        Boolean selectedPrimaryCandidate
) {}
