package com.vylop.backend.controller;

import com.vylop.backend.dto.LoginRequest;
import com.vylop.backend.dto.RegisterRequest;
import com.vylop.backend.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody RegisterRequest request) {
        String response = authService.registerUser(request);
        if (response.startsWith("Error")) {
            return ResponseEntity.badRequest().body(response);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody LoginRequest request) {
        String response = authService.loginUser(request);
        if (response.startsWith("Error")) {
            return ResponseEntity.status(401).body(response); // 401 Unauthorized
        }
        return ResponseEntity.ok(response);
    }
}