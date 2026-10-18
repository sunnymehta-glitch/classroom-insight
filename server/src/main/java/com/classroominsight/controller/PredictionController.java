package com.classroominsight.controller;

import com.classroominsight.dto.HistoryResponseDto;
import com.classroominsight.dto.OutcomeRequestDto;
import com.classroominsight.dto.OutcomeResponseDto;
import com.classroominsight.dto.PredictionRequestDto;
import com.classroominsight.dto.PredictionResponseDto;
import com.classroominsight.service.PredictionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/predictions")
public class PredictionController {

    private final PredictionService predictionService;

    public PredictionController(PredictionService predictionService) {
        this.predictionService = predictionService;
    }

    @PostMapping
    public ResponseEntity<PredictionResponseDto> createPrediction(@Valid @RequestBody PredictionRequestDto request) {
        PredictionResponseDto response = predictionService.createPrediction(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<HistoryResponseDto> getHistory(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "goal", required = false) String goal,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "from", required = false) String from,
            @RequestParam(name = "to", required = false) String to
    ) {
        String effectiveQuery = (q != null && !q.isBlank()) ? q : search;
        HistoryResponseDto history = predictionService.getHistory(page, size, goal, effectiveQuery, from, to);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PredictionResponseDto> getPredictionById(@PathVariable("id") UUID id) {
        PredictionResponseDto response = predictionService.getPredictionById(id);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/outcome")
    public ResponseEntity<OutcomeResponseDto> recordOutcome(
            @PathVariable("id") UUID id,
            @Valid @RequestBody OutcomeRequestDto request
    ) {
        OutcomeResponseDto response = predictionService.recordOutcome(id, request);
        return ResponseEntity.ok(response);
    }
}
