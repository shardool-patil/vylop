package com.vylop.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "room_files")
public class RoomFile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Links this file directly to a specific Room
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    // Using TEXT because code files can be much larger than a standard 255-character database string
    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private String language;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Automatically updates the timestamp every time the file is saved
    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public RoomFile() {
    }

    public RoomFile(Room room, String fileName, String content, String language) {
        this.room = room;
        this.fileName = fileName;
        this.content = content;
        this.language = language;
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}