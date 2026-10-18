package com.classroominsight.exception;

import com.classroominsight.dto.ErrorResponseDto;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponseDto> handleApiException(ApiException ex, HttpServletRequest request) {
        String requestId = resolveRequestId(request);
        logger.warn("API Exception [{}]: {}", ex.getErrorCode(), ex.getMessage());

        List<ErrorResponseDto.ErrorDetail> details = ex.getDetails().stream()
                .map(d -> new ErrorResponseDto.ErrorDetail(d.field(), d.issue()))
                .toList();

        ErrorResponseDto body = ErrorResponseDto.of(ex.getErrorCode(), ex.getMessage(), details, requestId);
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponseDto> handleValidationException(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String requestId = resolveRequestId(request);
        List<ErrorResponseDto.ErrorDetail> details = new ArrayList<>();

        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            details.add(new ErrorResponseDto.ErrorDetail(fieldError.getField(), fieldError.getDefaultMessage()));
        }

        logger.warn("Validation failure: {} errors", details.size());
        ErrorResponseDto body = ErrorResponseDto.of(
                "VALIDATION_ERROR",
                "Input validation failed. Please check the supplied feature values.",
                details,
                requestId
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponseDto> handleHttpMessageNotReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        String requestId = resolveRequestId(request);
        List<ErrorResponseDto.ErrorDetail> details = new ArrayList<>();

        Throwable cause = ex.getCause();
        if (cause instanceof UnrecognizedPropertyException unrecognized) {
            details.add(new ErrorResponseDto.ErrorDetail(
                    unrecognized.getPropertyName(),
                    "Unrecognized or forbidden field: " + unrecognized.getPropertyName()
            ));
        } else {
            details.add(new ErrorResponseDto.ErrorDetail(null, "Malformed JSON request body"));
        }

        logger.warn("Malformed JSON or unrecognized property: {}", ex.getMessage());
        ErrorResponseDto body = ErrorResponseDto.of(
                "VALIDATION_ERROR",
                "Input validation failed. Please check the supplied feature values.",
                details,
                requestId
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponseDto> handleGenericException(Exception ex, HttpServletRequest request) {
        String requestId = resolveRequestId(request);
        logger.error("Unhandled server exception (Request ID: " + requestId + ")", ex);

        ErrorResponseDto body = ErrorResponseDto.of(
                "INTERNAL_SERVER_ERROR",
                "An unexpected server error occurred during request processing.",
                List.of(),
                requestId
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private String resolveRequestId(HttpServletRequest request) {
        String header = request.getHeader("X-Request-ID");
        if (header != null && !header.isBlank()) {
            return header;
        }
        return "req-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
