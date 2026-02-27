package com.vylop.backend.config;

import com.vylop.backend.model.User;
import com.vylop.backend.repository.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Configuration
public class SecurityConfig {

    private final UserRepository userRepository;

    public SecurityConfig(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                // --- THE FIX: We added /api/execute to the whitelist ---
                .requestMatchers("/api/auth/**", "/ws/**", "/api/workspace/**", "/api/execute").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .successHandler(new AuthenticationSuccessHandler() {
                    @Override
                    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
                        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();
                        String email = oauthUser.getAttribute("email");
                        
                        String baseUsername = email.split("@")[0];
                        String finalUsername = baseUsername;

                        Optional<User> existingUser = userRepository.findByEmail(email);
                        
                        if (existingUser.isEmpty()) {
                            if (userRepository.findByUsername(baseUsername).isPresent()) {
                                finalUsername = baseUsername + UUID.randomUUID().toString().substring(0, 4);
                            }
                            
                            User newUser = new User();
                            newUser.setUsername(finalUsername);
                            newUser.setEmail(email);
                            newUser.setPassword(passwordEncoder().encode(UUID.randomUUID().toString())); 
                            userRepository.save(newUser);
                        } else {
                            finalUsername = existingUser.get().getUsername();
                        }

                        response.sendRedirect("http://localhost:5173/auth?googleUsername=" + finalUsername);
                    }
                })
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}