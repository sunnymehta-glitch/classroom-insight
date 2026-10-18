package com.classroominsight.controller;

import com.classroominsight.dto.ModelPredictionResultDto;
import com.classroominsight.dto.PredictionRequestDto;
import com.classroominsight.exception.ApiException;
import com.classroominsight.exception.UpstreamMlServiceException;
import com.classroominsight.repository.PredictionHistoryRepository;
import com.classroominsight.service.MlServiceClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class PredictionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PredictionHistoryRepository historyRepository;

    @MockBean
    private MlServiceClient mlServiceClient;

    @BeforeEach
    public void setup() {
        historyRepository.deleteAll();
    }

    @Test
    public void testCreatePrediction_SingleRegression_Success() throws Exception {
        MlServiceClient.InternalPredictionResponse internalResponse = new MlServiceClient.InternalPredictionResponse(
                "regression",
                "single",
                "success",
                List.of(new ModelPredictionResultDto(
                        "random_forest_regressor",
                        "1.0.0",
                        "success",
                        15.20,
                        null,
                        null
                ))
        );

        when(mlServiceClient.predict(any(PredictionRequestDto.class))).thenReturn(internalResponse);

        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "random_forest_regressor",
                  "student_reference": "STU-101",
                  "features": {
                    "G1": 14,
                    "G2": 15,
                    "studytime": 3,
                    "failures": 0,
                    "absences": 4,
                    "schoolsup": "no",
                    "famsup": "yes",
                    "paid": "no"
                  }
                }
                """;

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.goal").value("regression"))
                .andExpect(jsonPath("$.mode").value("single"))
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.prediction_id").isNotEmpty())
                .andExpect(jsonPath("$.results[0].predicted_grade").value(15.20));

        // Verify DB persistence
        assert historyRepository.count() == 1;
    }

    @Test
    public void testCreatePrediction_SingleClassification_Success() throws Exception {
        MlServiceClient.InternalPredictionResponse internalResponse = new MlServiceClient.InternalPredictionResponse(
                "classification",
                "single",
                "success",
                List.of(new ModelPredictionResultDto(
                        "logistic_regression",
                        "1.0.0",
                        "success",
                        null,
                        "pass",
                        null
                ))
        );

        when(mlServiceClient.predict(any(PredictionRequestDto.class))).thenReturn(internalResponse);

        String payload = """
                {
                  "goal": "classification",
                  "mode": "single",
                  "model_id": "logistic_regression",
                  "features": {
                    "G1": 14,
                    "G2": 15,
                    "studytime": 3,
                    "failures": 0,
                    "absences": 4,
                    "schoolsup": "no",
                    "famsup": "yes",
                    "paid": "no"
                  }
                }
                """;

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.goal").value("classification"))
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.results[0].predicted_class").value("pass"));
    }

    @Test
    public void testCreatePrediction_CompareMode_PartialSuccess() throws Exception {
        MlServiceClient.InternalPredictionResponse internalResponse = new MlServiceClient.InternalPredictionResponse(
                "regression",
                "compare",
                "partial_success",
                List.of(
                        new ModelPredictionResultDto("linear_regression", "1.0.0", "success", 14.82, null, null),
                        new ModelPredictionResultDto("svr", "1.0.0", "failed", null, null, "Model execution failed")
                )
        );

        when(mlServiceClient.predict(any(PredictionRequestDto.class))).thenReturn(internalResponse);

        String payload = """
                {
                  "goal": "regression",
                  "mode": "compare",
                  "model_ids": ["linear_regression", "svr"],
                  "features": {
                    "G1": 14,
                    "G2": 15,
                    "studytime": 3,
                    "failures": 0,
                    "absences": 4,
                    "schoolsup": "no",
                    "famsup": "yes",
                    "paid": "no"
                  }
                }
                """;

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("partial_success"))
                .andExpect(jsonPath("$.results.length()").value(2))
                .andExpect(jsonPath("$.results[0].status").value("success"))
                .andExpect(jsonPath("$.results[1].status").value("failed"))
                .andExpect(jsonPath("$.results[1].error_message").value("Model execution failed"));
    }

    @Test
    public void testCreatePrediction_InvalidModelSelection_ReturnsBadRequest() throws Exception {
        when(mlServiceClient.predict(any(PredictionRequestDto.class)))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MODEL_SELECTION", "Unknown model requested"));

        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "non_existent_model",
                  "features": {
                    "G1": 14,
                    "G2": 15,
                    "studytime": 3,
                    "failures": 0,
                    "absences": 4,
                    "schoolsup": "no",
                    "famsup": "yes",
                    "paid": "no"
                  }
                }
                """;

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_MODEL_SELECTION"));
    }

    @Test
    public void testCreatePrediction_AllModelsFailed_ReturnsBadGateway() throws Exception {
        MlServiceClient.InternalPredictionResponse internalResponse = new MlServiceClient.InternalPredictionResponse(
                "regression",
                "compare",
                "failed",
                List.of(
                        new ModelPredictionResultDto("linear_regression", "1.0.0", "failed", null, null, "Pipeline failure")
                )
        );

        when(mlServiceClient.predict(any(PredictionRequestDto.class))).thenReturn(internalResponse);

        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "linear_regression",
                  "features": {
                    "G1": 14,
                    "G2": 15,
                    "studytime": 3,
                    "failures": 0,
                    "absences": 4,
                    "schoolsup": "no",
                    "famsup": "yes",
                    "paid": "no"
                  }
                }
                """;

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error.code").value("ALL_MODELS_FAILED"));
    }

    @Test
    public void testCreatePrediction_MlServiceUnavailable_Returns503() throws Exception {
        when(mlServiceClient.predict(any(PredictionRequestDto.class)))
                .thenThrow(UpstreamMlServiceException.unavailable("Upstream ML service unavailable"));

        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "linear_regression",
                  "features": {
                    "G1": 14,
                    "G2": 15,
                    "studytime": 3,
                    "failures": 0,
                    "absences": 4,
                    "schoolsup": "no",
                    "famsup": "yes",
                    "paid": "no"
                  }
                }
                """;

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("UPSTREAM_UNAVAILABLE"));
    }

    @Test
    public void testCreatePrediction_MlServiceTimeout_Returns504() throws Exception {
        when(mlServiceClient.predict(any(PredictionRequestDto.class)))
                .thenThrow(UpstreamMlServiceException.timeout("Upstream ML service timed out."));

        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "linear_regression",
                  "features": {
                    "G1": 14,
                    "G2": 15,
                    "studytime": 3,
                    "failures": 0,
                    "absences": 4,
                    "schoolsup": "no",
                    "famsup": "yes",
                    "paid": "no"
                  }
                }
                """;

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.error.code").value("UPSTREAM_TIMEOUT"))
                .andExpect(jsonPath("$.error.message").value("Upstream ML service timed out."));
    }
}
