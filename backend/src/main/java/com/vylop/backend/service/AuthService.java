package com.vylop.backend.service;

import com.vylop.backend.dto.LoginRequest;
import com.vylop.backend.dto.RegisterRequest;
import com.vylop.backend.model.User;
import com.vylop.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public String registerUser(RegisterRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            return "Error: Username is already taken!";
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            return "Error: Email is already registered!";
        }

        // Create the user and hash the password
        User newUser = new User();
        newUser.setUsername(request.getUsername());
        newUser.setEmail(request.getEmail());
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));

        userRepository.save(newUser);
        return "Success: User registered successfully!";
    }

    public String loginUser(LoginRequest request) {
        Optional<User> userOptional = userRepository.findByUsername(request.getUsername());

        if (userOptional.isPresent()) {
            User user = userOptional.get();
            // Verify the raw password against the hashed database password
            if (passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                // In the next step, we will return a real JWT token here instead of a string
                return "Success: Logged in successfully!";
            }
        }
        return "Error: Invalid username or password!";
    }
}