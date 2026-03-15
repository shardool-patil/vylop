package com.vylop.backend.repository;

import com.vylop.backend.model.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {
    
    // Used for the Dashboard: fetches all workspaces owned by a specific user
    List<Workspace> findByUsername(String username);
    
    // Used for security: ensures a user actually owns the room before saving/deleting
    Optional<Workspace> findByIdAndUsername(UUID id, String username);
}