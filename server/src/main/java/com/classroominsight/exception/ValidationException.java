package com.classroominsight.exception;

import org.springframework.http.HttpStatus;
import java.util.List;

public class ValidationException extends ApiException {
    public ValidationException(String message, List<ValidationErrorDetail> details) {
        super(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, details);
    }

    public ValidationException(String message) {
        super(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }
}
