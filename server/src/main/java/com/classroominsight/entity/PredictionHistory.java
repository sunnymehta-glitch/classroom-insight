package com.classroominsight.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "prediction_history")
public class PredictionHistory {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "goal", nullable = false, length = 32)
    private String goal;

    @Column(name = "mode", nullable = false, length = 16)
    private String mode;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "student_reference", length = 32)
    private String studentReference;

    @Column(name = "g1", nullable = false)
    private Integer g1;

    @Column(name = "g2", nullable = false)
    private Integer g2;

    @Column(name = "studytime", nullable = false)
    private Integer studytime;

    @Column(name = "failures", nullable = false)
    private Integer failures;

    @Column(name = "absences", nullable = false)
    private Integer absences;

    @Column(name = "schoolsup", nullable = false, length = 8)
    private String schoolsup;

    @Column(name = "famsup", nullable = false, length = 8)
    private String famsup;

    @Column(name = "paid", nullable = false, length = 8)
    private String paid;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "schema_version", nullable = false, length = 16)
    private String schemaVersion;

    @OneToMany(mappedBy = "predictionHistory", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<PredictionResult> results = new ArrayList<>();

    @OneToOne(mappedBy = "predictionHistory", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private VerifiedOutcome verifiedOutcome;

    public PredictionHistory() {}

    public PredictionHistory(UUID id, String goal, String mode, String status, String studentReference,
                             Integer g1, Integer g2, Integer studytime, Integer failures, Integer absences,
                             String schoolsup, String famsup, String paid, Instant createdAt, String schemaVersion) {
        this.id = id;
        this.goal = goal;
        this.mode = mode;
        this.status = status;
        this.studentReference = studentReference;
        this.g1 = g1;
        this.g2 = g2;
        this.studytime = studytime;
        this.failures = failures;
        this.absences = absences;
        this.schoolsup = schoolsup;
        this.famsup = famsup;
        this.paid = paid;
        this.createdAt = createdAt;
        this.schemaVersion = schemaVersion;
    }

    public void addResult(PredictionResult result) {
        results.add(result);
        result.setPredictionHistory(this);
    }

    // Getters and setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getGoal() { return goal; }
    public void setGoal(String goal) { this.goal = goal; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getStudentReference() { return studentReference; }
    public void setStudentReference(String studentReference) { this.studentReference = studentReference; }

    public Integer getG1() { return g1; }
    public void setG1(Integer g1) { this.g1 = g1; }

    public Integer getG2() { return g2; }
    public void setG2(Integer g2) { this.g2 = g2; }

    public Integer getStudytime() { return studytime; }
    public void setStudytime(Integer studytime) { this.studytime = studytime; }

    public Integer getFailures() { return failures; }
    public void setFailures(Integer failures) { this.failures = failures; }

    public Integer getAbsences() { return absences; }
    public void setAbsences(Integer absences) { this.absences = absences; }

    public String getSchoolsup() { return schoolsup; }
    public void setSchoolsup(String schoolsup) { this.schoolsup = schoolsup; }

    public String getFamsup() { return famsup; }
    public void setFamsup(String famsup) { this.famsup = famsup; }

    public String getPaid() { return paid; }
    public void setPaid(String paid) { this.paid = paid; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String getSchemaVersion() { return schemaVersion; }
    public void setSchemaVersion(String schemaVersion) { this.schemaVersion = schemaVersion; }

    public List<PredictionResult> getResults() { return results; }
    public void setResults(List<PredictionResult> results) { this.results = results; }

    public VerifiedOutcome getVerifiedOutcome() { return verifiedOutcome; }
    public void setVerifiedOutcome(VerifiedOutcome verifiedOutcome) {
        this.verifiedOutcome = verifiedOutcome;
        if (verifiedOutcome != null) {
            verifiedOutcome.setPredictionHistory(this);
        }
    }
}
