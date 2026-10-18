package com.classroominsight.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@JsonIgnoreProperties(ignoreUnknown = false)
public record FeaturesDto(
        @NotNull(message = "G1 is required")
        @Min(value = 0, message = "G1 must be between 0 and 20")
        @Max(value = 20, message = "G1 must be between 0 and 20")
        @JsonProperty("G1")
        Integer G1,

        @NotNull(message = "G2 is required")
        @Min(value = 0, message = "G2 must be between 0 and 20")
        @Max(value = 20, message = "G2 must be between 0 and 20")
        @JsonProperty("G2")
        Integer G2,

        @NotNull(message = "studytime is required")
        @Min(value = 1, message = "studytime must be an integer in [1, 2, 3, 4]")
        @Max(value = 4, message = "studytime must be an integer in [1, 2, 3, 4]")
        @JsonProperty("studytime")
        Integer studytime,

        @NotNull(message = "failures is required")
        @Min(value = 0, message = "failures must be an integer in [0, 1, 2, 3]")
        @Max(value = 3, message = "failures must be an integer in [0, 1, 2, 3]. Category 4 is absent from dataset and rejected")
        @JsonProperty("failures")
        Integer failures,

        @NotNull(message = "absences is required")
        @Min(value = 0, message = "absences must be between 0 and 93")
        @Max(value = 93, message = "absences must be between 0 and 93")
        @JsonProperty("absences")
        Integer absences,

        @NotBlank(message = "schoolsup is required")
        @Pattern(regexp = "^(no|yes)$", message = "schoolsup must be 'no' or 'yes'")
        @JsonProperty("schoolsup")
        String schoolsup,

        @NotBlank(message = "famsup is required")
        @Pattern(regexp = "^(no|yes)$", message = "famsup must be 'no' or 'yes'")
        @JsonProperty("famsup")
        String famsup,

        @NotBlank(message = "paid is required")
        @Pattern(regexp = "^(no|yes)$", message = "paid must be 'no' or 'yes'")
        @JsonProperty("paid")
        String paid
) {}
