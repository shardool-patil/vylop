package com.vylop.backend.service;

import com.vylop.backend.dto.LoginRequest;
import com.vylop.backend.dto.RegisterRequest;
import com.vylop.backend.model.User;
import com.vylop.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public Map<String, String> registerUser(RegisterRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            return Map.of("error", "Username is already taken!");
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            return Map.of("error", "Email is already registered!");
        }

        User newUser = new User();
        newUser.setUsername(request.getUsername());
        newUser.setEmail(request.getEmail());
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));

        userRepository.save(newUser);
        return Map.of("message", "User registered successfully!", "username", request.getUsername());
    }

    public Map<String, String> loginUser(LoginRequest request) {
        Optional<User> userOptional = userRepository.findByUsername(request.getUsername());

        if (userOptional.isPresent()) {
            User user = userOptional.get();
            if (passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                return Map.of("message", "Logged in successfully!", "username", user.getUsername());
            }
        }
        return Map.of("error", "Invalid username or password!");
    }
}