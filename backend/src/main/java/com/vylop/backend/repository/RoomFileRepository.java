package com.vylop.backend.repository;

import com.vylop.backend.model.RoomFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoomFileRepository extends JpaRepository<RoomFile, UUID> {
    
    // Fetches every file that belongs to a specific workspace (Room)
    List<RoomFile> findByRoomId(UUID roomId);
    
    // Finds a specific file (like "main.py") inside a specific Room so we can update it
    Optional<RoomFile> findByRoomIdAndFileName(UUID roomId, String fileName);
}