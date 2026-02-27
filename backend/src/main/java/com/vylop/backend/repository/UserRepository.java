package com.vylop.backend.repository;

import com.vylop.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    
    // Spring Boot is so smart that just by naming this method "findByUsername",
    // it automatically writes the SQL: SELECT * FROM users WHERE username = ?
    Optional<User> findByUsername(String username);
    
    Optional<User> findByEmail(String email);
}