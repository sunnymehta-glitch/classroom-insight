package com.classroominsight.controller;

import com.classroominsight.dto.ModelInfoDto;
import com.classroominsight.dto.ModelListResponseDto;
import com.classroominsight.dto.PerformanceResponseDto;
import com.classroominsight.exception.UpstreamMlServiceException;
import com.classroominsight.service.MlServiceClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class ModelControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MlServiceClient mlServiceClient;

    @Test
    public void testListModels_Regression() throws Exception {
        ModelListResponseDto response = new ModelListResponseDto(
                "regression",
                List.of(
                        new ModelInfoDto("linear_regression", "Linear Regression", "Linear Regression", "1.0.0", "available", "Baseline", false),
                        new ModelInfoDto("random_forest_regressor", "Random Forest Regressor", "Random Forest", "1.0.0", "available", "Ensemble", true)
                )
        );

        when(mlServiceClient.listModels("regression")).thenReturn(response);

        mockMvc.perform(get("/api/models?goal=regression").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goal").value("regression"))
                .andExpect(jsonPath("$.models.length()").value(2))
                .andExpect(jsonPath("$.models[0].model_id").value("linear_regression"))
                .andExpect(jsonPath("$.models[1].selected_primary_candidate").value(true));
    }

    @Test
    public void testListModels_Classification() throws Exception {
        ModelListResponseDto response = new ModelListResponseDto(
                "classification",
                List.of(
                        new ModelInfoDto("logistic_regression", "Logistic Regression", "Logistic Regression", "1.0.0", "available", "Classifier", false),
                        new ModelInfoDto("random_forest_classifier", "Random Forest Classifier", "Random Forest", "1.0.0", "available", "Ensemble", true)
                )
        );

        when(mlServiceClient.listModels("classification")).thenReturn(response);

        mockMvc.perform(get("/api/models?goal=classification").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goal").value("classification"))
                .andExpect(jsonPath("$.models[0].model_id").value("logistic_regression"));
    }

    @Test
    public void testListModels_InvalidGoal() throws Exception {
        mockMvc.perform(get("/api/models?goal=clustering").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    public void testPerformance_Regression() throws Exception {
        PerformanceResponseDto response = new PerformanceResponseDto(
                "regression",
                "UCI Student Performance - Mathematics (student-mat.csv)",
                "Held-out test set (80/20 split), CV (5-fold) on train set",
                79,
                "2026-10-18T00:00:00Z",
                List.of(
                        new PerformanceResponseDto.ModelPerformanceDto(
                                "random_forest_regressor",
                                "Random Forest Regressor",
                                "1.0.0",
                                Map.of("mae", 1.1154, "rmse", 1.7787, "r2", 0.8425),
                                Map.of("cv_mae_mean", 0.969),
                                "evaluated"
                        )
                )
        );

        when(mlServiceClient.getPerformance("regression")).thenReturn(response);

        mockMvc.perform(get("/api/models/performance?goal=regression").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goal").value("regression"))
                .andExpect(jsonPath("$.test_sample_count").value(79))
                .andExpect(jsonPath("$.models[0].metrics.mae").value(1.1154));
    }

    @Test
    public void testPerformance_MlServiceUnavailable() throws Exception {
        when(mlServiceClient.getPerformance("regression"))
                .thenThrow(UpstreamMlServiceException.unavailable("Upstream ML service unavailable"));

        mockMvc.perform(get("/api/models/performance?goal=regression").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("UPSTREAM_UNAVAILABLE"));
    }
}
