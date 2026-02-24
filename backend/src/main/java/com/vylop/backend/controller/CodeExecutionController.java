package com.vylop.backend.controller;

import com.vylop.backend.service.CodeExecutionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/execute")
@CrossOrigin(origins = "http://localhost:5173") 
public class CodeExecutionController {

    @Autowired
    private CodeExecutionService executionService;

    // --- NEW: Memory-Based Rate Limiter ---
    // Stores the IP address and the timestamp of their last execution
    private final Map<String, Long> requestCounts = new ConcurrentHashMap<>();
    
    // Cooldown period in milliseconds (3000ms = 3 seconds)
    private static final long COOLDOWN_TIME = 3000;

    @PostMapping
    public ResponseEntity<String> runCode(@RequestBody Map<String, Object> payload, HttpServletRequest request) {
        
        // 1. Rate Limiting Check
        String clientIp = request.getRemoteAddr();
        long currentTime = System.currentTimeMillis();
        
        if (requestCounts.containsKey(clientIp)) {
            long lastRequestTime = requestCounts.get(clientIp);
            if (currentTime - lastRequestTime < COOLDOWN_TIME) {
                long timeLeft = (COOLDOWN_TIME - (currentTime - lastRequestTime)) / 1000;
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body("Rate limit exceeded. Please wait " + timeLeft + " seconds before running code again.");
            }
        }
        
        // Update their last request time
        requestCounts.put(clientIp, currentTime);

        // 2. Extract Payload
        String language = (String) payload.get("language");
        String code = (String) payload.get("code");
        String input = (String) payload.get("input");
        String mainFile = (String) payload.getOrDefault("mainFile", "Main.java");
        
        @SuppressWarnings("unchecked")
        Map<String, String> files = (Map<String, String>) payload.get("files");
        
        // 3. Execute securely
        String result = executionService.executeCode(language, code, input, mainFile, files);
        return ResponseEntity.ok(result);
    }
}