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
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CodeExecutionService {

    private static final String WANDBOX_API_URL = "https://wandbox.org/api/compile.json";
    private static final String WANDBOX_LIST_URL = "https://wandbox.org/api/list.json";
    private final RestTemplate restTemplate;
    
    // Caches the dynamically fetched compiler names so we only ask Wandbox once
    private final Map<String, String> compilerCache = new ConcurrentHashMap<>();

    // Disguise our Java backend as a standard Chrome Browser to bypass API bot-blocks
    private static final String BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    public CodeExecutionService() {
        this.restTemplate = new RestTemplate();
    }

    public String executeCode(String language, String code, String input, String mainFileName, Map<String, String> files) {
        try {
            String compiler = getDynamicCompilerName(language);
            if (compiler == null) {
                return "Error: Language '" + language + "' is not supported by the sandbox.";
            }

            // 1. Build the payload for Wandbox API
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("compiler", compiler);
            requestBody.put("code", code); 
            
            if (input != null && !input.isEmpty()) {
                requestBody.put("stdin", input);
            }

            if (files != null && files.size() > 1) {
                List<Map<String, String>> extraFiles = new ArrayList<>();
                for (Map.Entry<String, String> entry : files.entrySet()) {
                    if (!entry.getKey().equals(mainFileName)) {
                        Map<String, String> fileObj = new HashMap<>();
                        fileObj.put("file", entry.getKey());
                        fileObj.put("code", entry.getValue());
                        extraFiles.add(fileObj);
                    }
                }
                if (!extraFiles.isEmpty()) {
                    requestBody.put("codes", extraFiles);
                }
            }

            // 2. Attach our headers with the Browser User-Agent disguise
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.USER_AGENT, BROWSER_USER_AGENT);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            // 3. Send the POST request
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    WANDBOX_API_URL,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            // 4. Parse Wandbox Response
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                
                String status = String.valueOf(body.getOrDefault("status", "1"));
                String programMessage = body.containsKey("program_message") ? (String) body.get("program_message") : "";
                String compilerMessage = body.containsKey("compiler_message") ? (String) body.get("compiler_message") : "";
                
                if (!"0".equals(status)) {
                    return !compilerMessage.isEmpty() ? "Compilation Error:\n" + compilerMessage : "Runtime Error:\n" + programMessage;
                }
                
                return programMessage.isEmpty() ? compilerMessage : programMessage;
            }
            
            return "Error: Sandbox API returned an unexpected response.";

        } catch (Exception e) {
            return "Sandbox Connection Error: Failed to reach remote execution engine. Details: " + e.getMessage();
        }
    }

    private String getDynamicCompilerName(String frontendLang) {
        String wandboxLang;
        switch (frontendLang.toLowerCase()) {
            case "java": wandboxLang = "Java"; break;
            case "python": wandboxLang = "Python"; break;
            case "cpp": 
            case "c++": wandboxLang = "C++"; break;
            case "javascript": wandboxLang = "JavaScript"; break;
            case "typescript": wandboxLang = "TypeScript"; break;
            case "go": wandboxLang = "Go"; break;
            case "rust": wandboxLang = "Rust"; break;
            default: return null;
        }

        if (compilerCache.containsKey(wandboxLang)) {
            return compilerCache.get(wandboxLang);
        }

        try {
            // Attach the User-Agent disguise to the GET request as well
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.USER_AGENT, BROWSER_USER_AGENT);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    WANDBOX_LIST_URL,
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<Map<String, Object>> compilers = response.getBody();
                String selectedName = null;
                
                for (Map<String, Object> compiler : compilers) {
                    if (wandboxLang.equals(compiler.get("language"))) {
                        String name = (String) compiler.get("name");
                        selectedName = name; // Update with the latest one found
                        
                        if (name.contains("head")) {
                            break; 
                        }
                    }
                }
                
                if (selectedName != null) {
                    compilerCache.put(wandboxLang, selectedName);
                    return selectedName;
                }
            }
        } catch (Exception e) {
            System.out.println("Could not dynamically fetch compilers: " + e.getMessage());
        }
        
        // Final desperate fallback if their list.json API is completely offline
        String fallback;
        switch (wandboxLang) {
            case "Java": fallback = "openjdk-head"; break;
            case "Python": fallback = "cpython-head"; break;
            case "C++": fallback = "gcc-head"; break;
            case "JavaScript": fallback = "nodejs-head"; break;
            case "TypeScript": fallback = "typescript-head"; break;
            case "Go": fallback = "go-head"; break;
            case "Rust": fallback = "rust-head"; break;
            default: fallback = null; break;
        }
        return fallback;
    }
}