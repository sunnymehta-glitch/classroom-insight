package com.classroominsight.controller;

import com.classroominsight.dto.ModelListResponseDto;
import com.classroominsight.dto.PerformanceResponseDto;
import com.classroominsight.exception.ApiException;
import com.classroominsight.service.MlServiceClient;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/models")
public class ModelController {

    private final MlServiceClient mlServiceClient;

    public ModelController(MlServiceClient mlServiceClient) {
        this.mlServiceClient = mlServiceClient;
    }

    @GetMapping
    public ResponseEntity<ModelListResponseDto> listModels(@RequestParam(name = "goal", required = true) String goal) {
        validateGoal(goal);
        ModelListResponseDto response = mlServiceClient.listModels(goal.trim().toLowerCase());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/performance")
    public ResponseEntity<PerformanceResponseDto> getPerformance(@RequestParam(name = "goal", required = true) String goal) {
        validateGoal(goal);
        PerformanceResponseDto response = mlServiceClient.getPerformance(goal.trim().toLowerCase());
        return ResponseEntity.ok(response);
    }

    private void validateGoal(String goal) {
        if (goal == null || (!"regression".equalsIgnoreCase(goal.trim()) && !"classification".equalsIgnoreCase(goal.trim()))) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "VALIDATION_ERROR",
                    "Invalid goal '" + goal + "'. Allowed values: 'regression', 'classification'."
            );
        }
    }
}
