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
    public String runCode(@RequestBody Map<String, String> payload) {
        // 1. Get all three values from the Frontend
        String language = payload.get("language");
        String code = payload.get("code");
        String input = payload.get("input"); // <--- This matches the 'input' from React
        
        // 2. Pass all three to the Service
        // This fixes the "Unresolved compilation problem" error
        return executionService.executeCode(language, code, input);
    }
}