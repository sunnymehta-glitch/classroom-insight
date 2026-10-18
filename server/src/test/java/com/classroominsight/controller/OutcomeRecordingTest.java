package com.classroominsight.controller;

import com.classroominsight.entity.PredictionHistory;
import com.classroominsight.entity.PredictionResult;
import com.classroominsight.repository.PredictionHistoryRepository;
import com.classroominsight.repository.VerifiedOutcomeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class OutcomeRecordingTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PredictionHistoryRepository historyRepository;

    @Autowired
    private VerifiedOutcomeRepository outcomeRepository;

    @BeforeEach
    public void setup() {
        outcomeRepository.deleteAll();
        historyRepository.deleteAll();
    }

    @Test
    public void testRecordOutcome_PassDerived_Success() throws Exception {
        UUID predictionId = createSamplePrediction();

        String payload = """
                {
                  "actual_g3": 15,
                  "source": "teacher_reported",
                  "notes": "Verified end-of-term examination"
                }
                """;

        mockMvc.perform(post("/api/predictions/" + predictionId + "/outcome")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prediction_id").value(predictionId.toString()))
                .andExpect(jsonPath("$.actual_g3").value(15))
                .andExpect(jsonPath("$.actual_pass_status").value("pass"))
                .andExpect(jsonPath("$.source").value("teacher_reported"))
                .andExpect(jsonPath("$.verification_status").value("recorded"));

        assertEquals(1, outcomeRepository.count());
    }

    @Test
    public void testRecordOutcome_FailDerived_Success() throws Exception {
        UUID predictionId = createSamplePrediction();

        String payload = """
                {
                  "actual_g3": 8,
                  "source": "teacher_reported"
                }
                """;

        mockMvc.perform(post("/api/predictions/" + predictionId + "/outcome")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actual_g3").value(8))
                .andExpect(jsonPath("$.actual_pass_status").value("fail"));
    }

    @Test
    public void testRecordOutcome_DuplicateOutcome_Returns409Conflict() throws Exception {
        UUID predictionId = createSamplePrediction();

        String payload = """
                {
                  "actual_g3": 14,
                  "source": "teacher_reported"
                }
                """;

        // First submission succeeds
        mockMvc.perform(post("/api/predictions/" + predictionId + "/outcome")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk());

        // Second submission on same prediction must return 409 Conflict
        mockMvc.perform(post("/api/predictions/" + predictionId + "/outcome")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    public void testRecordOutcome_OutOfRange_Rejected() throws Exception {
        UUID predictionId = createSamplePrediction();

        String payload = """
                {
                  "actual_g3": 25,
                  "source": "teacher_reported"
                }
                """;

        mockMvc.perform(post("/api/predictions/" + predictionId + "/outcome")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    public void testRecordOutcome_ZeroModelRetraining_ArtifactsUntouched() throws Exception {
        Path artifactsPath = Paths.get("../ml-service/artifacts").toAbsolutePath().normalize();
        if (!Files.exists(artifactsPath)) {
            artifactsPath = Paths.get("ml-service/artifacts").toAbsolutePath().normalize();
        }

        Map<String, String> hashesBefore = new HashMap<>();
        if (Files.exists(artifactsPath)) {
            try (Stream<Path> stream = Files.list(artifactsPath)) {
                stream.filter(p -> p.toString().endsWith(".joblib")).forEach(p -> {
                    try {
                        hashesBefore.put(p.getFileName().toString(), computeSha256(p));
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                });
            }
        }

        UUID predictionId = createSamplePrediction();
        String payload = """
                {
                  "actual_g3": 16,
                  "source": "teacher_reported"
                }
                """;

        mockMvc.perform(post("/api/predictions/" + predictionId + "/outcome")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk());

        // Invariant: ML model artifacts are NEVER altered when recording outcomes
        if (!hashesBefore.isEmpty()) {
            for (Map.Entry<String, String> entry : hashesBefore.entrySet()) {
                Path file = artifactsPath.resolve(entry.getKey());
                String hashAfter = computeSha256(file);
                assertEquals(entry.getValue(), hashAfter, "Model artifact was modified during outcome recording: " + entry.getKey());
            }
        }
    }

    private UUID createSamplePrediction() {
        UUID predictionId = UUID.randomUUID();
        PredictionHistory h = new PredictionHistory(
                predictionId, "regression", "single", "success", "STU-200",
                14, 15, 3, 0, 4, "no", "yes", "no", Instant.now(), "1.0.0"
        );
        h.addResult(new PredictionResult("random_forest_regressor", "1.0.0", "success", 15.2, null, null));
        historyRepository.save(h);
        return predictionId;
    }

    private String computeSha256(Path path) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream is = Files.newInputStream(path)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = is.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        byte[] hash = digest.digest();
        StringBuilder hexString = new StringBuilder();
        for (byte b : hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }
}
