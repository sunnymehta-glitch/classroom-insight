package com.classroominsight.controller;

import com.classroominsight.entity.PredictionHistory;
import com.classroominsight.entity.PredictionResult;
import com.classroominsight.repository.PredictionHistoryRepository;
import com.classroominsight.service.MlServiceClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class PredictionHistoryTest {

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
    public void testGetHistory_PaginationAndFiltering() throws Exception {
        UUID id1 = UUID.randomUUID();
        PredictionHistory h1 = new PredictionHistory(
                id1, "regression", "single", "success", "STU-ALPHA",
                14, 15, 3, 0, 4, "no", "yes", "no", Instant.now().minusSeconds(100), "1.0.0"
        );
        h1.addResult(new PredictionResult("linear_regression", "1.0.0", "success", 14.82, null, null));
        historyRepository.save(h1);

        UUID id2 = UUID.randomUUID();
        PredictionHistory h2 = new PredictionHistory(
                id2, "classification", "single", "success", "STU-BETA",
                10, 11, 2, 1, 8, "yes", "no", "yes", Instant.now(), "1.0.0"
        );
        h2.addResult(new PredictionResult("logistic_regression", "1.0.0", "success", null, "pass", null));
        historyRepository.save(h2);

        // Test pagination and filtering by goal
        mockMvc.perform(get("/api/predictions?goal=regression&page=0&size=10").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_elements").value(1))
                .andExpect(jsonPath("$.items[0].prediction_id").value(id1.toString()))
                .andExpect(jsonPath("$.items[0].student_reference").value("STU-ALPHA"))
                .andExpect(jsonPath("$.items[0].primary_result").value("14.82 (linear_regression)"));

        // Test search query filter
        mockMvc.perform(get("/api/predictions?q=beta").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_elements").value(1))
                .andExpect(jsonPath("$.items[0].prediction_id").value(id2.toString()))
                .andExpect(jsonPath("$.items[0].student_reference").value("STU-BETA"));
    }

    @Test
    public void testGetPredictionById_ZeroInferenceRerun() throws Exception {
        UUID id = UUID.randomUUID();
        PredictionHistory h = new PredictionHistory(
                id, "regression", "single", "success", "STU-100",
                12, 13, 2, 0, 5, "no", "no", "no", Instant.now(), "1.0.0"
        );
        h.addResult(new PredictionResult("random_forest_regressor", "1.0.0", "success", 12.95, null, null));
        historyRepository.save(h);

        mockMvc.perform(get("/api/predictions/" + id).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prediction_id").value(id.toString()))
                .andExpect(jsonPath("$.goal").value("regression"))
                .andExpect(jsonPath("$.results[0].predicted_grade").value(12.95));

        // Invariant: ML Service is NEVER called to retrieve saved prediction
        verifyNoInteractions(mlServiceClient);
    }

    @Test
    public void testGetPredictionById_NotFound_Returns404() throws Exception {
        UUID missingId = UUID.randomUUID();
        mockMvc.perform(get("/api/predictions/" + missingId).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }
}
