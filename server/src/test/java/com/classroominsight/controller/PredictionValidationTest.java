package com.classroominsight.controller;

import com.classroominsight.service.MlServiceClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class PredictionValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MlServiceClient mlServiceClient;

    @Test
    public void testMissingFeature_G1() throws Exception {
        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "linear_regression",
                  "features": {
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
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("features.G1"));
    }

    @Test
    public void testDisallowedFeature_G3_Leakage() throws Exception {
        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "linear_regression",
                  "features": {
                    "G1": 14,
                    "G2": 15,
                    "G3": 16,
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
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    public void testFailures_Category4_Rejected() throws Exception {
        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "linear_regression",
                  "features": {
                    "G1": 14,
                    "G2": 15,
                    "studytime": 3,
                    "failures": 4,
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
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("features.failures"));
    }

    @Test
    public void testOutOfRange_G1_Above20() throws Exception {
        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "linear_regression",
                  "features": {
                    "G1": 25,
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
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("features.G1"));
    }

    @Test
    public void testOutOfRange_Absences_Above93() throws Exception {
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
                    "absences": 95,
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
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("features.absences"));
    }

    @Test
    public void testInvalidCategorical_Schoolsup() throws Exception {
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
                    "schoolsup": "invalid_value",
                    "famsup": "yes",
                    "paid": "no"
                  }
                }
                """;

        mockMvc.perform(post("/api/predictions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("features.schoolsup"));
    }

    @Test
    public void testInvalidStudentReference_TooLong() throws Exception {
        String payload = """
                {
                  "goal": "regression",
                  "mode": "single",
                  "model_id": "linear_regression",
                  "student_reference": "this_student_reference_is_much_too_long_and_exceeds_32_characters",
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
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("studentReference"));
    }
}
