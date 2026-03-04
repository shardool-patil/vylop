package com.vylop.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication
public class BackendApplication {

    public static void main(String[] args) {
        // 1. Force the JVM to use the modern, IANA-compliant timezone name immediately
        // This runs before Spring Boot or the Database Driver initializes.
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
        
        SpringApplication.run(BackendApplication.class, args);
    }

    @PostConstruct
    public void init() {
        // 2. Ensure it sticks even after Spring initializes
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
    }
}