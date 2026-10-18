package com.classroominsight.service;

import com.classroominsight.dto.*;
import com.classroominsight.entity.PredictionHistory;
import com.classroominsight.entity.PredictionResult;
import com.classroominsight.entity.VerifiedOutcome;
import com.classroominsight.exception.ApiException;
import com.classroominsight.exception.ConflictException;
import com.classroominsight.exception.ResourceNotFoundException;
import com.classroominsight.repository.PredictionHistoryRepository;
import com.classroominsight.repository.VerifiedOutcomeRepository;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class PredictionService {

    private static final Logger logger = LoggerFactory.getLogger(PredictionService.class);

    private final PredictionHistoryRepository historyRepository;
    private final VerifiedOutcomeRepository outcomeRepository;
    private final MlServiceClient mlServiceClient;

    public PredictionService(PredictionHistoryRepository historyRepository,
                             VerifiedOutcomeRepository outcomeRepository,
                             MlServiceClient mlServiceClient) {
        this.historyRepository = historyRepository;
        this.outcomeRepository = outcomeRepository;
        this.mlServiceClient = mlServiceClient;
    }

    @Transactional
    public PredictionResponseDto createPrediction(PredictionRequestDto request) {
        validateRequestRules(request);

        // 1. Execute upstream inference via FastAPI
        MlServiceClient.InternalPredictionResponse upstreamResponse = mlServiceClient.predict(request);

        // 2. Reject total inference failure
        if ("failed".equalsIgnoreCase(upstreamResponse.status())) {
            logger.warn("All requested models failed during upstream inference");
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "ALL_MODELS_FAILED",
                    "All requested models failed during inference execution."
            );
        }

        // 3. Persist record in file-backed H2
        UUID predictionId = UUID.randomUUID();
        Instant now = Instant.now();

        FeaturesDto f = request.features();
        PredictionHistory history = new PredictionHistory(
                predictionId,
                request.goal(),
                request.mode(),
                upstreamResponse.status(),
                request.studentReference(),
                f.G1(),
                f.G2(),
                f.studytime(),
                f.failures(),
                f.absences(),
                f.schoolsup(),
                f.famsup(),
                f.paid(),
                now,
                "1.0.0"
        );

        for (ModelPredictionResultDto resDto : upstreamResponse.results()) {
            PredictionResult resEntity = new PredictionResult(
                    resDto.modelId(),
                    resDto.modelVersion() != null ? resDto.modelVersion() : "1.0.0",
                    resDto.status(),
                    resDto.predictedGrade(),
                    resDto.predictedClass(),
                    resDto.errorMessage()
            );
            history.addResult(resEntity);
        }

        PredictionHistory saved = historyRepository.save(history);
        logger.info("Persisted prediction record '{}' with status '{}'", saved.getId(), saved.getStatus());

        return mapToResponseDto(saved);
    }

    @Transactional(readOnly = true)
    public HistoryResponseDto getHistory(int page, int size, String goal, String q, String from, String to) {
        int boundedSize = Math.min(Math.max(size, 1), 100);
        int boundedPage = Math.max(page, 0);

        PageRequest pageRequest = PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Specification<PredictionHistory> spec = (root, querySpec, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (goal != null && !goal.isBlank()) {
                predicates.add(cb.equal(root.get("goal"), goal.trim()));
            }

            if (q != null && !q.isBlank()) {
                String term = "%" + q.trim().toLowerCase() + "%";
                Predicate matchRef = cb.like(cb.lower(root.get("studentReference")), term);
                Predicate matchId = cb.like(cb.lower(root.get("id").as(String.class)), term);
                predicates.add(cb.or(matchRef, matchId));
            }

            if (from != null && !from.isBlank()) {
                try {
                    predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), Instant.parse(from.trim())));
                } catch (Exception ignored) {}
            }

            if (to != null && !to.isBlank()) {
                try {
                    predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), Instant.parse(to.trim())));
                } catch (Exception ignored) {}
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<PredictionHistory> pageResult = historyRepository.findAll(spec, pageRequest);

        List<HistoryItemDto> items = pageResult.getContent().stream()
                .map(this::mapToHistoryItemDto)
                .toList();

        return new HistoryResponseDto(
                items,
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public PredictionResponseDto getPredictionById(UUID id) {
        PredictionHistory history = historyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prediction record not found for ID: " + id));

        return mapToResponseDto(history);
    }

    @Transactional
    public OutcomeResponseDto recordOutcome(UUID predictionId, OutcomeRequestDto request) {
        PredictionHistory history = historyRepository.findById(predictionId)
                .orElseThrow(() -> new ResourceNotFoundException("Prediction record not found for ID: " + predictionId));

        if (outcomeRepository.existsByPredictionHistoryId(predictionId)) {
            logger.warn("Attempted duplicate outcome recording for prediction '{}'", predictionId);
            throw new ConflictException("Outcome has already been recorded for prediction ID: " + predictionId);
        }

        UUID outcomeId = UUID.randomUUID();
        Instant now = Instant.now();
        String actualPassStatus = request.actualG3() >= 10 ? "pass" : "fail";

        VerifiedOutcome outcome = new VerifiedOutcome(
                outcomeId,
                history,
                request.actualG3(),
                actualPassStatus,
                request.getEffectiveSource(),
                request.getEffectiveVerificationStatus(),
                request.notes(),
                now
        );

        outcomeRepository.save(outcome);
        logger.info("Recorded verified outcome '{}' for prediction '{}'", outcomeId, predictionId);

        return new OutcomeResponseDto(
                outcome.getId(),
                history.getId(),
                outcome.getActualG3(),
                outcome.getActualPassStatus(),
                outcome.getSource(),
                outcome.getVerificationStatus(),
                outcome.getNotes(),
                outcome.getRecordedAt().toString()
        );
    }

    private void validateRequestRules(PredictionRequestDto request) {
        if ("single".equalsIgnoreCase(request.mode())) {
            List<String> effectiveIds = request.getEffectiveModelIds();
            if (effectiveIds.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "model_id is required when mode is 'single'");
            }
            if (effectiveIds.size() > 1) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Only one model may be requested when mode is 'single'");
            }
        } else if ("compare".equalsIgnoreCase(request.mode())) {
            List<String> modelIds = request.modelIds();
            if (modelIds == null || modelIds.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "model_ids must be non-empty when mode is 'compare'");
            }
            Set<String> uniqueIds = new HashSet<>(modelIds);
            if (uniqueIds.size() != modelIds.size()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "model_ids cannot contain duplicate entries");
            }
        }
    }

    private PredictionResponseDto mapToResponseDto(PredictionHistory entity) {
        FeaturesDto features = new FeaturesDto(
                entity.getG1(),
                entity.getG2(),
                entity.getStudytime(),
                entity.getFailures(),
                entity.getAbsences(),
                entity.getSchoolsup(),
                entity.getFamsup(),
                entity.getPaid()
        );

        List<ModelPredictionResultDto> results = entity.getResults().stream()
                .map(r -> new ModelPredictionResultDto(
                        r.getModelId(),
                        r.getModelVersion(),
                        r.getStatus(),
                        r.getPredictedGrade(),
                        r.getPredictedClass(),
                        r.getErrorMessage()
                ))
                .toList();

        OutcomeResponseDto outcomeDto = null;
        if (entity.getVerifiedOutcome() != null) {
            VerifiedOutcome vo = entity.getVerifiedOutcome();
            outcomeDto = new OutcomeResponseDto(
                    vo.getId(),
                    entity.getId(),
                    vo.getActualG3(),
                    vo.getActualPassStatus(),
                    vo.getSource(),
                    vo.getVerificationStatus(),
                    vo.getNotes(),
                    vo.getRecordedAt().toString()
            );
        }

        return new PredictionResponseDto(
                entity.getId(),
                entity.getGoal(),
                entity.getMode(),
                entity.getStatus(),
                entity.getStudentReference(),
                features,
                results,
                entity.getCreatedAt().toString(),
                entity.getSchemaVersion(),
                outcomeDto
        );
    }

    private HistoryItemDto mapToHistoryItemDto(PredictionHistory entity) {
        List<String> modelsUsed = entity.getResults().stream()
                .map(PredictionResult::getModelId)
                .toList();

        String primaryResult = "N/A";
        for (PredictionResult r : entity.getResults()) {
            if ("success".equalsIgnoreCase(r.getStatus())) {
                if ("regression".equalsIgnoreCase(entity.getGoal()) && r.getPredictedGrade() != null) {
                    primaryResult = String.format(Locale.US, "%.2f (%s)", r.getPredictedGrade(), r.getModelId());
                    break;
                } else if ("classification".equalsIgnoreCase(entity.getGoal()) && r.getPredictedClass() != null) {
                    primaryResult = String.format("%s (%s)", r.getPredictedClass(), r.getModelId());
                    break;
                }
            }
        }

        boolean hasRecordedOutcome = entity.getVerifiedOutcome() != null;

        return new HistoryItemDto(
                entity.getId(),
                entity.getGoal(),
                entity.getMode(),
                entity.getStatus(),
                entity.getStudentReference(),
                modelsUsed,
                primaryResult,
                hasRecordedOutcome,
                entity.getCreatedAt().toString()
        );
    }
}
