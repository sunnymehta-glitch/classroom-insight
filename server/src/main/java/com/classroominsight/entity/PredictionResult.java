package com.classroominsight.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "prediction_results")
public class PredictionResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false)
    private PredictionHistory predictionHistory;

    @Column(name = "model_id", nullable = false, length = 64)
    private String modelId;

    @Column(name = "model_version", nullable = false, length = 32)
    private String modelVersion;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "predicted_grade")
    private Double predictedGrade;

    @Column(name = "predicted_class", length = 16)
    private String predictedClass;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    public PredictionResult() {}

    public PredictionResult(String modelId, String modelVersion, String status,
                            Double predictedGrade, String predictedClass, String errorMessage) {
        this.modelId = modelId;
        this.modelVersion = modelVersion;
        this.status = status;
        this.predictedGrade = predictedGrade;
        this.predictedClass = predictedClass;
        this.errorMessage = errorMessage;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public PredictionHistory getPredictionHistory() { return predictionHistory; }
    public void setPredictionHistory(PredictionHistory predictionHistory) { this.predictionHistory = predictionHistory; }

    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getPredictedGrade() { return predictedGrade; }
    public void setPredictedGrade(Double predictedGrade) { this.predictedGrade = predictedGrade; }

    public String getPredictedClass() { return predictedClass; }
    public void setPredictedClass(String predictedClass) { this.predictedClass = predictedClass; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
