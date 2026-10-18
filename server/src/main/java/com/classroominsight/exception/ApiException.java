package com.classroominsight.exception;

import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.List;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String errorCode;
    private final List<ValidationErrorDetail> details;

    public ApiException(HttpStatus status, String errorCode, String message) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.details = Collections.emptyList();
    }

    public ApiException(HttpStatus status, String errorCode, String message, List<ValidationErrorDetail> details) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.details = details != null ? details : Collections.emptyList();
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public List<ValidationErrorDetail> getDetails() {
        return details;
    }

    public record ValidationErrorDetail(String field, String issue) {}
}
