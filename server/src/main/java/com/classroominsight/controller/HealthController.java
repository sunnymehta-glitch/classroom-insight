package com.classroominsight.controller;

import com.classroominsight.dto.AppHealthResponseDto;
import com.classroominsight.service.HealthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final HealthService healthService;

    public HealthController(HealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping
    public ResponseEntity<AppHealthResponseDto> getHealth() {
        HealthService.HealthResult result = healthService.checkHealth();
        return ResponseEntity.status(result.httpStatusCode()).body(result.responseBody());
    }
}
