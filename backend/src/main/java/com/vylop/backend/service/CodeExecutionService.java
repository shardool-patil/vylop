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

    // Using the public Piston API for secure remote code execution
    private static final String PISTON_API_URL = "https://emacs.piston.rs/api/v2/execute";
    private final RestTemplate restTemplate;

    public CodeExecutionService() {
        this.restTemplate = new RestTemplate();
    }

    public String executeCode(String language, String code, String input, String mainFileName, Map<String, String> files) {
        try {
            String pistonLang = mapLanguage(language);
            if (pistonLang == null) {
                return "Error: Language '" + language + "' is not supported.";
            }

            // 1. Build the payload for the Piston API
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("language", pistonLang);
            requestBody.put("version", "*"); // Asterisk tells Piston to use the latest available version

            List<Map<String, String>> pistonFiles = new ArrayList<>();
            
            // 2. Map frontend files to Piston's required file array structure
            if (files != null && !files.isEmpty()) {
                for (Map.Entry<String, String> entry : files.entrySet()) {
                    Map<String, String> fileObj = new HashMap<>();
                    fileObj.put("name", entry.getKey());
                    fileObj.put("content", entry.getValue());
                    pistonFiles.add(fileObj);
                }
            } else {
                // Fallback if no files map is provided
                Map<String, String> fileObj = new HashMap<>();
                fileObj.put("name", mainFileName);
                fileObj.put("content", code);
                pistonFiles.add(fileObj);
            }
            
            requestBody.put("files", pistonFiles);

            // 3. Attach STDIN if the user provided any
            if (input != null && !input.isEmpty()) {
                requestBody.put("stdin", input);
            }

            // 4. Send the POST request to the API
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            // FIX: Using ParameterizedTypeReference cleanly maps the JSON without raw type warnings or missing imports
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    PISTON_API_URL,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            // 5. Parse the Response Safely
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                
                // Check for compilation errors first (e.g., C++ or Java syntax errors)
                if (body.containsKey("compile")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> compile = (Map<String, Object>) body.get("compile");
                    if (compile.containsKey("code") && ((Integer) compile.get("code")) != 0) {
                        return "Compilation Error:\n" + compile.get("stderr");
                    }
                }
                
                // Check for runtime execution output
                if (body.containsKey("run")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> run = (Map<String, Object>) body.get("run");
                    String stdout = (String) run.getOrDefault("stdout", "");
                    String stderr = (String) run.getOrDefault("stderr", "");
                    
                    return stderr.isEmpty() ? stdout : stdout + "\nError Output:\n" + stderr;
                }
            }
            
            return "Error: Could not execute code. Piston API returned an unexpected response.";

        } catch (Exception e) {
            return "Sandbox Connection Error: Failed to reach remote execution engine. Details: " + e.getMessage();
        }
    }

    /**
     * Maps the frontend language string to the exact language identifier required by Piston API.
     */
    private String mapLanguage(String language) {
        switch (language.toLowerCase()) {
            case "java": return "java";
            case "python": return "python";
            case "cpp": 
            case "c++": return "cpp";
            case "javascript": return "javascript";
            case "typescript": return "typescript";
            case "go": return "go";
            case "rust": return "rust";
            default: return null;
        }
    }
}