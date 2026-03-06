package com.vylop.backend.controller;

import com.vylop.backend.service.WorkspaceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/workspace")
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    public WorkspaceController(WorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    /**
     * Called by the host when first joining a room.
     * Registers the room name so guests can sync it immediately.
     */
    @PostMapping("/{roomId}/register")
    public ResponseEntity<String> registerRoom(
            @PathVariable UUID roomId,
            @RequestParam String username,
            @RequestParam String roomName) {

        String response = workspaceService.registerRoom(roomId, username, roomName);
        if (response.startsWith("Error")) {
            return ResponseEntity.badRequest().body(response);
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<Map<String, Object>> getWorkspaceMetadata(@PathVariable UUID roomId) {
        Map<String, Object> metadata = workspaceService.getWorkspaceMetadata(roomId);
        if (metadata.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(metadata);
    }

    @GetMapping("/{roomId}/load")
    public ResponseEntity<Map<String, String>> loadWorkspace(@PathVariable UUID roomId) {
        Map<String, String> files = workspaceService.loadWorkspace(roomId);
        return ResponseEntity.ok(files);
    }

    @PostMapping("/{roomId}/save")
    public ResponseEntity<String> saveWorkspace(
            @PathVariable UUID roomId,
            @RequestParam String username,
            @RequestParam String roomName,
            @RequestBody Map<String, String> files) {
        
        String response = workspaceService.saveWorkspace(roomId, username, roomName, files);
        if (response.startsWith("Error")) {
            return ResponseEntity.badRequest().body(response);
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/user/{username}")
    public ResponseEntity<List<Map<String, Object>>> getUserWorkspaces(@PathVariable String username) {
        return ResponseEntity.ok(workspaceService.getUserWorkspaces(username));
    }

    @DeleteMapping("/{roomId}/delete")
    public ResponseEntity<String> deleteWorkspace(
            @PathVariable UUID roomId, 
            @RequestParam String username) {
        
        String response = workspaceService.deleteWorkspace(roomId, username);
        if (response.startsWith("Error")) {
            return ResponseEntity.badRequest().body(response);
        }
        return ResponseEntity.ok(response);
    }
}