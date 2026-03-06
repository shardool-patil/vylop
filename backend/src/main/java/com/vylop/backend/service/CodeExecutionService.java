package com.vylop.backend.service;

import org.springframework.boot.json.JsonParser;
import org.springframework.boot.json.JsonParserFactory;
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
    private final JsonParser springJsonParser;
    
    private final Map<String, String> compilerCache = new ConcurrentHashMap<>();

    private static final String BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    public CodeExecutionService() {
        this.restTemplate = new RestTemplate();
        this.springJsonParser = JsonParserFactory.getJsonParser();
    }

    public String executeCode(String language, String code, String input, String mainFileName, Map<String, String> files) {
        try {
            String compiler = getDynamicCompilerName(language);
            if (compiler == null) {
                return "Error: Language '" + language + "' is not supported by the sandbox.";
            }

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("compiler", compiler);
            
            if (input != null && !input.isEmpty()) {
                requestBody.put("stdin", input);
            }

            // 1. Filter out workspace pollution (e.g., don't send C++ files to the Go compiler)
            List<Map<String, String>> extraFiles = new ArrayList<>();
            if (files != null && !files.isEmpty()) {
                for (Map.Entry<String, String> entry : files.entrySet()) {
                    String fName = entry.getKey();
                    if (!fName.equals(mainFileName) && isRelatedFile(fName, language)) {
                        Map<String, String> fileObj = new HashMap<>();
                        fileObj.put("file", fName);
                        fileObj.put("code", entry.getValue());
                        extraFiles.add(fileObj);
                    }
                }
            }

            // 2. Handle Java's strict filename requirement
            if (language.equalsIgnoreCase("java")) {
                // Wandbox forces the top-level 'code' to be named 'prog.java'.
                // To prevent the "class Main is public" error, we put a dummy comment here...
                requestBody.put("code", "// Entry point is in " + mainFileName);
                
                // ...and put the actual main code into the extra files array with its proper name.
                Map<String, String> mainFileObj = new HashMap<>();
                mainFileObj.put("file", mainFileName);
                mainFileObj.put("code", code);
                extraFiles.add(mainFileObj);
            } else {
                requestBody.put("code", code);
            }

            if (!extraFiles.isEmpty()) {
                requestBody.put("codes", extraFiles);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.USER_AGENT, BROWSER_USER_AGENT);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    WANDBOX_API_URL,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = springJsonParser.parseMap(response.getBody());
                
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

    /**
     * Checks if a file belongs to the currently executing language to prevent compiler crashes.
     */
    private boolean isRelatedFile(String fileName, String language) {
        if (fileName == null) return false;
        String lower = fileName.toLowerCase();
        switch (language.toLowerCase()) {
            case "java": return lower.endsWith(".java");
            case "python": return lower.endsWith(".py");
            case "cpp": 
            case "c++": return lower.endsWith(".cpp") || lower.endsWith(".c") || lower.endsWith(".h") || lower.endsWith(".hpp");
            case "javascript": return lower.endsWith(".js");
            case "typescript": return lower.endsWith(".ts");
            case "go": return lower.endsWith(".go");
            case "rust": return lower.endsWith(".rs");
            default: return true;
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
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.USER_AGENT, BROWSER_USER_AGENT);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    WANDBOX_LIST_URL,
                    HttpMethod.GET,
                    entity,
                    String.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<Object> compilers = springJsonParser.parseList(response.getBody());
                String selectedName = null;
                
                for (Object obj : compilers) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> compiler = (Map<String, Object>) obj;
                    
                    if (wandboxLang.equalsIgnoreCase((String) compiler.get("language"))) {
                        String name = (String) compiler.get("name");
                        selectedName = name; 
                        
                        // FIX: If the compiler name does NOT contain "head", it's a stable version.
                        // We break immediately to prefer stable versions over broken experimental ones.
                        if (!name.contains("head")) {
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
        
        // Fallbacks
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