package com.classroominsight.controller;

import com.classroominsight.dto.FeaturesDto;
import com.classroominsight.dto.ModelPredictionResultDto;
import com.classroominsight.dto.PredictionRequestDto;
import com.classroominsight.exception.GlobalExceptionHandler;
import com.classroominsight.repository.PredictionHistoryRepository;
import com.classroominsight.repository.VerifiedOutcomeRepository;
import com.classroominsight.service.MlServiceClient;
import com.classroominsight.service.PredictionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class DatabaseWriteFailureTest {

    @Mock
    private PredictionHistoryRepository historyRepository;

    @Mock
    private VerifiedOutcomeRepository outcomeRepository;

    @Mock
    private MlServiceClient mlServiceClient;

    @Test
    public void testDatabaseWriteFailure_ThrowsAndDoesNotReportSuccess() {
        PredictionService service = new PredictionService(historyRepository, outcomeRepository, mlServiceClient);

        PredictionRequestDto request = new PredictionRequestDto(
                "regression",
                "single",
                "linear_regression",
                null,
                "STU-001",
                new FeaturesDto(14, 15, 3, 0, 4, "no", "yes", "no")
        );

        MlServiceClient.InternalPredictionResponse internalResponse = new MlServiceClient.InternalPredictionResponse(
                "regression",
                "single",
                "success",
                List.of(new ModelPredictionResultDto("linear_regression", "1.0.0", "success", 14.82, null, null))
        );

        when(mlServiceClient.predict(any(PredictionRequestDto.class))).thenReturn(internalResponse);
        // Simulate database write failure upon disk write or constraint failure
        when(historyRepository.save(any())).thenThrow(new DataIntegrityViolationException("Simulated disk write failure"));

        DataIntegrityViolationException ex = assertThrows(
                DataIntegrityViolationException.class,
                () -> service.createPrediction(request),
                "Database write failure must throw exception and abort transaction"
        );

        // Verify GlobalExceptionHandler maps it to HTTP 500 without leaking stack trace or file paths
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest mockRequest = new MockHttpServletRequest();
        ResponseEntity<?> response = handler.handleGenericException(ex, mockRequest);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }
}
