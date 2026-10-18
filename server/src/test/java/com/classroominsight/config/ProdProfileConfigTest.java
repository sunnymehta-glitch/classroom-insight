package com.classroominsight.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PropertiesLoaderUtils;

import java.io.IOException;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;

public class ProdProfileConfigTest {

    @Test
    public void testProdProfilePropertiesExistAndAreValid() throws IOException {
        ClassPathResource resource = new ClassPathResource("application-prod.properties");
        assertTrue(resource.exists(), "application-prod.properties must exist on classpath");

        Properties props = PropertiesLoaderUtils.loadProperties(resource);

        assertEquals("org.postgresql.Driver", props.getProperty("spring.datasource.driver-class-name"),
                "Production profile must use PostgreSQL driver");
        assertEquals("org.hibernate.dialect.PostgreSQLDialect", props.getProperty("spring.jpa.database-platform"),
                "Production profile must use PostgreSQL Hibernate dialect");
        assertEquals("false", props.getProperty("spring.h2.console.enabled"),
                "H2 console must be disabled in production");
        assertTrue(props.getProperty("spring.datasource.url", "").contains("${SPRING_DATASOURCE_URL}"),
                "Production datasource URL must bind to SPRING_DATASOURCE_URL");
    }
}
