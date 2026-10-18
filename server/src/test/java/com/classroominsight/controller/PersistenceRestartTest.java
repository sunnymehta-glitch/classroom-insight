package com.classroominsight.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.jdbc.DataSourceBuilder;

import javax.sql.DataSource;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class PersistenceRestartTest {

    @Test
    public void testFileBackedH2_SurvivesProcessRestart(@TempDir Path tempDir) throws Exception {
        String dbPath = tempDir.resolve("test_restart_db").toAbsolutePath().toString().replace("\\", "/");
        String jdbcUrl = "jdbc:h2:file:" + dbPath + ";DB_CLOSE_DELAY=-1;AUTO_SERVER=TRUE";

        UUID expectedId = UUID.randomUUID();

        // Phase 1: Connect, create table, insert record, and shut down connection
        DataSource ds1 = DataSourceBuilder.create()
                .url(jdbcUrl)
                .driverClassName("org.h2.Driver")
                .username("sa")
                .password("")
                .build();

        try (Connection conn = ds1.getConnection()) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("""
                    CREATE TABLE test_prediction (
                        id VARCHAR(36) PRIMARY KEY,
                        goal VARCHAR(32) NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        predicted_grade DOUBLE
                    )
                """);
            }

            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO test_prediction (id, goal, status, predicted_grade) VALUES (?, ?, ?, ?)")) {
                ps.setString(1, expectedId.toString());
                ps.setString(2, "regression");
                ps.setString(3, "success");
                ps.setDouble(4, 15.2);
                ps.executeUpdate();
            }
        }

        // Phase 2: Simulate application process restart by creating a completely new DataSource
        DataSource ds2 = DataSourceBuilder.create()
                .url(jdbcUrl)
                .driverClassName("org.h2.Driver")
                .username("sa")
                .password("")
                .build();

        try (Connection conn2 = ds2.getConnection()) {
            try (PreparedStatement ps = conn2.prepareStatement(
                    "SELECT goal, status, predicted_grade FROM test_prediction WHERE id = ?")) {
                ps.setString(1, expectedId.toString());
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next(), "Record must survive database restart in file-backed mode");
                    assertEquals("regression", rs.getString("goal"));
                    assertEquals("success", rs.getString("status"));
                    assertEquals(15.2, rs.getDouble("predicted_grade"), 0.001);
                }
            }
        }
    }
}
