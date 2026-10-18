package com.classroominsight.repository;

import com.classroominsight.entity.VerifiedOutcome;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface VerifiedOutcomeRepository extends JpaRepository<VerifiedOutcome, UUID> {
    Optional<VerifiedOutcome> findByPredictionHistoryId(UUID predictionId);
    boolean existsByPredictionHistoryId(UUID predictionId);
}
