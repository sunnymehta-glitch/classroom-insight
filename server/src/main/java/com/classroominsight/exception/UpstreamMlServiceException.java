package com.classroominsight.exception;

import org.springframework.http.HttpStatus;

public class UpstreamMlServiceException extends ApiException {
    public UpstreamMlServiceException(HttpStatus status, String errorCode, String message) {
        super(status, errorCode, message);
    }

    public static UpstreamMlServiceException unavailable(String message) {
        return new UpstreamMlServiceException(HttpStatus.SERVICE_UNAVAILABLE, "UPSTREAM_UNAVAILABLE", message);
    }

    public static UpstreamMlServiceException timeout(String message) {
        return new UpstreamMlServiceException(HttpStatus.GATEWAY_TIMEOUT, "UPSTREAM_TIMEOUT", message);
    }

    public static UpstreamMlServiceException badGateway(String message) {
        return new UpstreamMlServiceException(HttpStatus.BAD_GATEWAY, "UPSTREAM_BAD_GATEWAY", message);
    }
}
