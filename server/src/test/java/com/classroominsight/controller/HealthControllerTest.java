package com.classroominsight.controller;

import com.classroominsight.dto.AppHealthResponseDto;
import com.classroominsight.service.HealthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private HealthService healthService;

    @Test
    public void testHealthEndpoint_Up() throws Exception {
        AppHealthResponseDto response = new AppHealthResponseDto(
                "UP",
                "1.0.0",
                "2026-10-18T00:00:00Z",
                Map.of(
                        "database", new AppHealthResponseDto.ComponentHealthDto("UP", Map.of("database", "H2")),
                        "ml_service", new AppHealthResponseDto.ComponentHealthDto("UP", Map.of("models_loaded", 10))
                )
        );

        when(healthService.checkHealth()).thenReturn(new HealthService.HealthResult("UP", 200, response));

        mockMvc.perform(get("/api/health").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components.database.status").value("UP"))
                .andExpect(jsonPath("$.components.ml_service.status").value("UP"));
    }

    @Test
    public void testHealthEndpoint_Degraded() throws Exception {
        AppHealthResponseDto response = new AppHealthResponseDto(
                "DEGRADED",
                "1.0.0",
                "2026-10-18T00:00:00Z",
                Map.of(
                        "database", new AppHealthResponseDto.ComponentHealthDto("UP", Map.of("database", "H2")),
                        "ml_service", new AppHealthResponseDto.ComponentHealthDto("DOWN", Map.of("url", "http://localhost:8000"))
                )
        );

        when(healthService.checkHealth()).thenReturn(new HealthService.HealthResult("DEGRADED", 200, response));

        mockMvc.perform(get("/api/health").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DEGRADED"))
                .andExpect(jsonPath("$.components.database.status").value("UP"))
                .andExpect(jsonPath("$.components.ml_service.status").value("DOWN"));
    }

    @Test
    public void testHealthEndpoint_Down() throws Exception {
        AppHealthResponseDto response = new AppHealthResponseDto(
                "DOWN",
                "1.0.0",
                "2026-10-18T00:00:00Z",
                Map.of(
                        "database", new AppHealthResponseDto.ComponentHealthDto("DOWN", Map.of("error", "Connection failed")),
                        "ml_service", new AppHealthResponseDto.ComponentHealthDto("UP", Map.of("models_loaded", 10))
                )
        );

        when(healthService.checkHealth()).thenReturn(new HealthService.HealthResult("DOWN", 503, response));

        mockMvc.perform(get("/api/health").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DOWN"))
                .andExpect(jsonPath("$.components.database.status").value("DOWN"));
    }
}
