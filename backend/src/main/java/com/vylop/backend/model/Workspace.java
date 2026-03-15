package com.vylop.backend.model;

import jakarta.persistence.*;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "workspaces")
public class Workspace {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String roomName;

    @Column(nullable = false)
    private String username; // The owner of the workspace

    // Maps the file name (key) to the code content (value)
    @ElementCollection
    @CollectionTable(name = "workspace_files", joinColumns = @JoinColumn(name = "workspace_id"))
    @MapKeyColumn(name = "file_name")
    @Column(name = "file_content", columnDefinition = "TEXT")
    private Map<String, String> files;

    public Workspace() {}

    public Workspace(UUID id, String roomName, String username) {
        this.id = id;
        this.roomName = roomName;
        this.username = username;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getRoomName() {
        return roomName;
    }

    public void setRoomName(String roomName) {
        this.roomName = roomName;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public Map<String, String> getFiles() {
        return files;
    }

    public void setFiles(Map<String, String> files) {
        this.files = files;
    }
}