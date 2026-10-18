package com.classroominsight.repository;

import com.classroominsight.entity.PredictionHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PredictionHistoryRepository extends JpaRepository<PredictionHistory, UUID>, JpaSpecificationExecutor<PredictionHistory> {
}
