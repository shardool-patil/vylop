package com.vylop.backend.service;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CodeExecutionService {

    // Switched to Wandbox API: 100% free, no API keys, and no IP whitelists required.
    private static final String WANDBOX_API_URL = "https://wandbox.org/api/compile.json";
    private final RestTemplate restTemplate;

    public CodeExecutionService() {
        this.restTemplate = new RestTemplate();
    }

    public String executeCode(String language, String code, String input, String mainFileName, Map<String, String> files) {
        try {
            String compiler = mapLanguageToCompiler(language);
            if (compiler == null) {
                return "Error: Language '" + language + "' is not supported by the sandbox.";
            }

            // 1. Build the payload for Wandbox API
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("compiler", compiler);
            requestBody.put("code", code); // The main file's code
            
            // Attach STDIN if provided
            if (input != null && !input.isEmpty()) {
                requestBody.put("stdin", input);
            }

            // 2. Map additional files (Wandbox uses a "codes" array for multi-file projects)
            if (files != null && files.size() > 1) {
                List<Map<String, String>> extraFiles = new ArrayList<>();
                for (Map.Entry<String, String> entry : files.entrySet()) {
                    // Skip the main file since it's already attached above
                    if (!entry.getKey().equals(mainFileName)) {
                        Map<String, String> fileObj = new HashMap<>();
                        fileObj.put("file", entry.getKey());
                        fileObj.put("content", entry.getValue());
                        extraFiles.add(fileObj);
                    }
                }
                if (!extraFiles.isEmpty()) {
                    requestBody.put("codes", extraFiles);
                }
            }

            // 3. Send the POST request
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    WANDBOX_API_URL,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            // 4. Parse Wandbox Response Safely
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                
                String status = String.valueOf(body.getOrDefault("status", "1"));
                String programMessage = body.containsKey("program_message") ? (String) body.get("program_message") : "";
                String compilerMessage = body.containsKey("compiler_message") ? (String) body.get("compiler_message") : "";
                
                // If execution failed (status != 0), return the exact error
                if (!"0".equals(status)) {
                    return !compilerMessage.isEmpty() ? "Compilation Error:\n" + compilerMessage : "Runtime Error:\n" + programMessage;
                }
                
                // If successful, return output (fallback to compiler message if no console output)
                return programMessage.isEmpty() ? compilerMessage : programMessage;
            }
            
            return "Error: Sandbox API returned an unexpected response.";

        } catch (Exception e) {
            return "Sandbox Connection Error: Failed to reach remote execution engine. Details: " + e.getMessage();
        }
    }

    /**
     * Maps the frontend language string to the exact compiler name required by Wandbox API.
     */
    private String mapLanguageToCompiler(String language) {
        switch (language.toLowerCase()) {
            case "java": return "openjdk-head";
            case "python": return "cpython-head";
            case "cpp": 
            case "c++": return "gcc-head";
            case "javascript": return "nodejs-head";
            case "typescript": return "typescript-head";
            case "go": return "go-head";
            case "rust": return "rust-head";
            default: return null;
        }
    }
}