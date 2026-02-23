package com.vylop.backend.controller;

import com.vylop.backend.service.CodeExecutionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/execute")
@CrossOrigin(origins = "http://localhost:5173") 
public class CodeExecutionController {

    @Autowired
    private CodeExecutionService executionService;

    @PostMapping
    public String runCode(@RequestBody Map<String, Object> payload) {
        String language = (String) payload.get("language");
        String code = (String) payload.get("code");
        String input = (String) payload.get("input");
        
        // --- NEW: Read the active tab and the multi-file bundle ---
        String mainFile = (String) payload.getOrDefault("mainFile", "Main.java");
        
        @SuppressWarnings("unchecked")
        Map<String, String> files = (Map<String, String>) payload.get("files");
        
        return executionService.executeCode(language, code, input, mainFile, files);
    }
}