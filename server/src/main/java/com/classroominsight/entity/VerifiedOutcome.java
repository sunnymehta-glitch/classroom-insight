package com.classroominsight.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "verified_outcomes")
public class VerifiedOutcome {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false, unique = true)
    private PredictionHistory predictionHistory;

    @Column(name = "actual_g3", nullable = false)
    private Integer actualG3;

    @Column(name = "actual_pass_status", nullable = false, length = 16)
    private String actualPassStatus;

    @Column(name = "source", nullable = false, length = 64)
    private String source;

    @Column(name = "verification_status", nullable = false, length = 32)
    private String verificationStatus;

    @Column(name = "notes", length = 2048)
    private String notes;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    public VerifiedOutcome() {}

    public VerifiedOutcome(UUID id, PredictionHistory predictionHistory, Integer actualG3,
                           String actualPassStatus, String source, String verificationStatus,
                           String notes, Instant recordedAt) {
        this.id = id;
        this.predictionHistory = predictionHistory;
        this.actualG3 = actualG3;
        this.actualPassStatus = actualPassStatus;
        this.source = source;
        this.verificationStatus = verificationStatus;
        this.notes = notes;
        this.recordedAt = recordedAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public PredictionHistory getPredictionHistory() { return predictionHistory; }
    public void setPredictionHistory(PredictionHistory predictionHistory) { this.predictionHistory = predictionHistory; }

    public Integer getActualG3() { return actualG3; }
    public void setActualG3(Integer actualG3) { this.actualG3 = actualG3; }

    public String getActualPassStatus() { return actualPassStatus; }
    public void setActualPassStatus(String actualPassStatus) { this.actualPassStatus = actualPassStatus; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
}
