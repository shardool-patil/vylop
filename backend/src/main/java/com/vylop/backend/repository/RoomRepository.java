package com.vylop.backend.repository;

import com.vylop.backend.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RoomRepository extends JpaRepository<Room, UUID> {
    
    // NEW: Finds all rooms hosted by a specific user, sorted newest first!
    List<Room> findByHostUsernameOrderByCreatedAtDesc(String username);
}